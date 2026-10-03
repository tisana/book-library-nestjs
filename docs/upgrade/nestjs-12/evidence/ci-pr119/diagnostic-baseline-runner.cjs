const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const DefaultRunner = require('/workspace/book-library-nestjs/node_modules/jest-runner').default;
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
function snapshot(tests) {
  const rootDir = tests[0]?.context.config.rootDir;
  if (!rootDir || !rootDir.startsWith('/tmp/')) return null;
  return {
    schemaVersion: 1,
    rootDir,
    // Actual Stryker delta: dry-run true, mutant false; reporting-only.
    configHash: sha(JSON.stringify(Object.fromEntries(Object.entries(tests[0].context.config).filter(([key])=>key!=='testLocationInResults')))),
    sourceHash: sha(fs.readFileSync(path.join(rootDir, 'auth/token-session.service.ts'))),
    files: tests.map(test => ({path:test.path,hash:sha(fs.readFileSync(test.path))})).sort((a,b)=>a.path.localeCompare(b.path)),
  };
}
class BaselineSuiteRunner extends DefaultRunner {
  constructor(...args) {
    super(...args);
    this.results = new Map();
    this.on('test-file-success', ([test, result]) => this.results.set(test.path,result));
  }
  async runTests(tests, watcher, options) {
    const pattern = this._globalConfig.testNamePattern;
    let binding;
    try { binding=snapshot(tests); } catch {}
    fs.appendFileSync('/tmp/ci-baseline-configs.jsonl',JSON.stringify({pid:process.pid,pattern,binding,config:tests[0]?.context.config})+'\n');
    const inventoryPath = binding && path.join(path.dirname(binding.rootDir), '.ci-baseline-suite-inventory.json');
    let selected = tests;
    let reason = 'no-pattern-or-missing-binding';
    if (pattern && binding) {
      try {
        const inventory=JSON.parse(fs.readFileSync(inventoryPath,'utf8'));
        if (JSON.stringify(binding)!==JSON.stringify(inventory.binding)) throw new Error('Stale inventory');
        if (tests.some(test=>!Array.isArray(inventory.names[test.path]) || !inventory.names[test.path].length)) throw new Error('Incomplete inventory');
        const regex=new RegExp(pattern,'i');
        selected=tests.filter(test=>inventory.names[test.path].some(name=>regex.test(name)));
        reason='verified-baseline';
      } catch (error) { reason='unknown-or-invalid-inventory:'+error.message; }
    }
    fs.appendFileSync('/tmp/ci-baseline-suite-dispatch.jsonl',JSON.stringify({pid:process.pid,activeMutant:process.env.__STRYKER_ACTIVE_MUTANT__,pattern,reason,all:tests.map(t=>t.path),selected:selected.map(t=>t.path)})+'\n');
    const result = await super.runTests(selected,watcher,options);
    // Only successful unfiltered, unmutated full baseline can publish inventory.
    if (!pattern && process.env.__STRYKER_ACTIVE_MUTANT__===undefined && binding && tests.length && this.results.size===tests.length && tests.every(test=>{
      const result=this.results.get(test.path);
      return !result.testExecError && result.testResults.length && result.testResults.every(test=>test.status==='passed');
    })) {
      const inventory={binding,names:Object.fromEntries(tests.map(test=>[test.path,this.results.get(test.path).testResults.map(test=>test.fullName)]))};
      const temporary=inventoryPath+'.'+process.pid+'.tmp';
      fs.writeFileSync(temporary,JSON.stringify(inventory));fs.renameSync(temporary,inventoryPath);
      fs.appendFileSync('/tmp/ci-baseline-published.jsonl',JSON.stringify({pid:process.pid,inventoryPath,binding})+'\n');
    }
    return result;
  }
}
module.exports=BaselineSuiteRunner;
