import { UnauthorizedException, ServiceUnavailableException } from '@nestjs/common';
import {
  parseRepairCliInput,
  runRepairCli,
} from '../scripts/resolve-auth-identifier-conflict';
import { AuthIdentifierOperationStatus } from '../src/auth/schemas/auth-identifier-operation.schema';
import { AuthIdentifierSubjectType } from '../src/auth/schemas/auth-identifier.schema';

describe('offline identifier repair CLI adapter (e2e)', () => {
  const manifest = {
    conflictId: 'conflict-1',
    reassignments: [
      {
        subjectType: AuthIdentifierSubjectType.Member,
        subjectId: 'member-1',
        newIdentifier: 'replacement@example.test',
      },
    ],
  };

  function io(input: Record<string, unknown>) {
    const output: string[] = [];
    return {
      output,
      adapter: {
        read: jest.fn().mockResolvedValue(JSON.stringify(input)),
        write: jest.fn((value: string) => output.push(value)),
        writeError: jest.fn(),
      },
    };
  }

  it('accepts token only through stdin and delegates a redacted dry run', async () => {
    const service = {
      dryRun: jest.fn().mockResolvedValue({
        operationId: 'repair-1',
        status: AuthIdentifierOperationStatus.Pending,
        assignmentCount: 1,
        batchCount: 1,
        replayed: false,
        reasonCategory: 'identifier-offline-repair-pending',
      }),
    };
    const fixture = io({
      action: 'dry-run',
      token: 'secret-token-value',
      operationId: 'repair-1',
      manifest,
    });

    await expect(runRepairCli(service as never, fixture.adapter)).resolves.toBe(0);
    expect(service.dryRun).toHaveBeenCalledWith(expect.objectContaining({
      token: 'secret-token-value',
      operationId: 'repair-1',
    }));
    expect(fixture.output.join('')).not.toContain('secret-token-value');
    expect(fixture.output.join('')).not.toContain('replacement@example.test');
  });

  it('rejects actor overrides and confirmation refusal without service invocation', async () => {
    expect(() =>
      parseRepairCliInput(JSON.stringify({
        action: 'apply',
        token: 'token',
        operationId: 'repair-1',
        actorId: 'spoofed-admin',
        manifest,
      })),
    ).toThrow('invalid-input');

    const service = { apply: jest.fn() };
    const fixture = io({
      action: 'apply',
      token: 'token',
      operationId: 'repair-1',
      manifest,
      confirmation: 'NO',
    });
    await expect(runRepairCli(service as never, fixture.adapter)).resolves.toBe(2);
    expect(service.apply).not.toHaveBeenCalled();
    expect(JSON.parse(fixture.output[0])).toEqual({
      status: 'refused',
      reason: 'confirmation-required',
    });
  });

  it.each([
    [new ServiceUnavailableException('repair-key-required'), 3, 'resumable'],
    [new UnauthorizedException('authorization-denied'), 4, 'denied'],
  ])('maps service failures to fixed redacted exit contracts', async (error, code, status) => {
    const service = { cancel: jest.fn().mockRejectedValue(error) };
    const fixture = io({
      action: 'cancel',
      token: 'secret-token-value',
      operationId: 'repair-1',
      manifest,
      confirmation: 'CANCEL',
    });

    await expect(runRepairCli(service as never, fixture.adapter)).resolves.toBe(code);
    expect(JSON.parse(fixture.output[0])).toEqual(expect.objectContaining({ status }));
    expect(fixture.output[0]).not.toContain('secret-token-value');
    expect(fixture.output[0]).not.toContain('replacement@example.test');
  });
});
