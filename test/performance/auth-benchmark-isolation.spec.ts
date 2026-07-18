import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import * as ts from 'typescript';
import { AuthBenchmarkController, authBenchmarkResponse } from './auth-benchmark.controller';

describe('test-only authentication benchmark isolation', () => {
  it('keeps equivalent handlers while applying the real auth boundary only to protected', () => {
    const controller = new AuthBenchmarkController();
    const prototype = AuthBenchmarkController.prototype;

    expect(controller.unprotected()).toBe(authBenchmarkResponse);
    expect(controller.protected()).toBe(authBenchmarkResponse);
    expect(Reflect.getMetadata(PATH_METADATA, AuthBenchmarkController)).toBe(
      '__test/auth-benchmark',
    );
    expect(Reflect.getMetadata(PATH_METADATA, prototype.unprotected)).toBe(
      'unprotected',
    );
    expect(Reflect.getMetadata(PATH_METADATA, prototype.protected)).toBe(
      'protected',
    );
    expect(Reflect.getMetadata(METHOD_METADATA, prototype.unprotected)).toBe(
      Reflect.getMetadata(METHOD_METADATA, prototype.protected),
    );
    expect(Reflect.getMetadata(GUARDS_METADATA, prototype.unprotected)).toBeUndefined();
    expect(Reflect.getMetadata(GUARDS_METADATA, prototype.protected)).toHaveLength(2);
  });

  it('excludes benchmark modules and routes from the production AppModule and build', () => {
    const root = process.cwd();
    const appModuleSource = readFileSync(join(root, 'src', 'app.module.ts'), 'utf8');
    const buildConfigPath = join(root, 'tsconfig.build.json');
    const buildConfig = ts.readConfigFile(buildConfigPath, ts.sys.readFile);
    const parsedBuildConfig = ts.parseJsonConfigFileContent(
      buildConfig.config,
      ts.sys,
      root,
      undefined,
      buildConfigPath,
    );

    expect(appModuleSource).not.toMatch(/AuthBenchmark|__test\/auth-benchmark/);
    expect(buildConfig.error).toBeUndefined();
    expect(parsedBuildConfig.errors).toHaveLength(0);
    expect(parsedBuildConfig.fileNames).not.toEqual(
      expect.arrayContaining([
        expect.stringMatching(/test[/\\]performance[/\\]auth-benchmark/),
      ]),
    );
  });
});
