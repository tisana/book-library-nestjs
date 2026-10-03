const fs = require('node:fs');
const mode = process.env.MEMBERS_CONTROL_MODE;
const Base = mode === 'candidate'
 ? require('/workspace/book-library-nestjs/scripts/quality/mutation-jest-runner.cjs')
 : require('/workspace/book-library-nestjs/node_modules/jest-runner').default;
class Observer extends Base {
 constructor(...args) {
  super(...args);
  this.on('test-file-success', ([test,result]) => fs.appendFileSync(`/tmp/members-paired-${mode}-events.jsonl`, JSON.stringify({pid:process.pid,activeMutant:process.env.__STRYKER_ACTIVE_MUTANT__,pattern:this._globalConfig.testNamePattern,file:test.path,errors:Boolean(result.testExecError),tests:result.testResults.map(t=>({name:t.fullName,status:t.status,duration:t.duration}))})+'\n'));
 }
}
module.exports = Observer;
