import hashlib,json,subprocess,time
from pathlib import Path
repo=Path('/workspace/book-library-nestjs')
scratch=Path('/tmp/nestjs-pr119-ci')
head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip()
assert head=='6871bb72035229e3a262b020a8c82e1ca25efa65'
bp=repo/'test/quality/mutation-baseline.json'
original=bp.read_bytes()
assert original==subprocess.check_output(['git','show','HEAD:test/quality/mutation-baseline.json'],cwd=repo)
historical=json.loads(original)
config='17196a829ccf2cecdd793ab64fca18029d5b3392c89af5bd7e784cdc8bfd8d12'
results=[]
for shard in ['members','token-session','identifier-repair','identifier-reconciliation','borrowings']:
    assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip()==head
    assert bp.read_bytes()==original
    if shard in ['identifier-reconciliation','borrowings']:
        print('Start remaining complete shard: '+shard,flush=True)
        with (scratch/f'complete-{shard}-{head[:8]}.txt').open('w') as out:
            run=subprocess.run(['node','scripts/quality/run-mutation.mjs','complete-shard',shard],cwd=repo,stdout=out,stderr=subprocess.STDOUT,timeout=940)
        assert run.returncode==0
    directory=repo/f'reports/mutation/complete/shards/{shard}'
    summary=json.loads((directory/'summary.json').read_text())
    report=json.loads((directory/'mutation.json').read_text())
    assert summary['commitSha']==head and summary['configurationSha256']==config
    assert not summary['timedOut'] and summary['artifactExitCode']==0 and summary['strykerExitCode']==0
    assert summary['durationMs']<=900000
    results.append(summary)
    print(f"Validated {shard}: {summary['durationMs']:.0f}ms, actual report retained",flush=True)
manifest=json.loads((repo/'test/quality/critical-rule-manifest.json').read_text())
hashes={rule['source']:rule['sourceSha256'] for rule in manifest['rules']}
recorded=False
try:
    bp.write_text(json.dumps({**historical,'sourceSha256':hashes},indent=2)+'\n')
    for command,name in [(['node','scripts/quality/run-mutation.mjs','complete-merge'],'complete-merge'),(['node','scripts/quality/mutation-policy.mjs','record-baseline','reports/mutation/complete/mutation.json'],'record-baseline')]:
        with (scratch/f'{name}-{head[:8]}.txt').open('w') as out:
            subprocess.run(command,cwd=repo,stdout=out,stderr=subprocess.STDOUT,check=True)
    baseline=json.loads(bp.read_text())
    summary=json.loads((repo/'reports/mutation/complete/summary.json').read_text())
    assert summary['policyPassed'] and summary['policyExitCode']==0
    assert summary['canonicalMutantCount']==1744 and summary['commitSha']==head
    assert baseline['generatedFromCommit']==head and baseline['sourceSha256']==hashes
    assert baseline['rawCombinedScore']==summary['rawCombinedScore']>=historical['rawCombinedScore']
    proof={'producerCommit':head,'historicalBaselineSha256':hashlib.sha256(original).hexdigest(),'historicalFloor':historical['rawCombinedScore'],'historicalBytesUnchangedDuringAllShards':True,'resumedThreeSettledArtifactsWithoutRebinding':True,'temporaryHashCarrierUsedOnlyForMergeAndRecord':True,'canonicalMutantCount':1744,'rawCombinedScore':summary['rawCombinedScore'],'policyPassed':True,'configurationSha256':config,'shards':results}
    (scratch/'complete-collection-proof.json').write_text(json.dumps(proof,indent=2)+'\n')
    recorded=True
    print(f"Complete policy PASS:1744 mutants, score {summary['rawCombinedScore']:.8f}; genuine baseline recorded",flush=True)
finally:
    if not recorded:
        bp.write_bytes(original)
        print('Restored exact historical baseline after failure',flush=True)
