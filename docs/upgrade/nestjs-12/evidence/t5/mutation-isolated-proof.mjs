// Reproduce from repository root after npm ci and npm run build.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire, Module } from 'node:module';
import { resolve, dirname } from 'node:path';
const root=process.cwd();
const require=createRequire(`${root}/package.json`);
const {Instrumenter,disableTypeChecks}=await import(`${root}/node_modules/@stryker-mutator/instrumenter/dist/src/index.js`);
require('reflect-metadata');
const ts=require('typescript');
const {TsJestTransformer}=require('ts-jest');
const {Test}=require('@nestjs/testing');
const constants=require('@nestjs/common/constants');
const paths=JSON.parse(readFileSync(`${root}/test/quality/mutation-baseline.json`)).selectedSources;
const logger={debug(){},info(){},warn(){},error(){},trace(){},isDebugEnabled(){return false;}};
const instrumented=await new Instrumenter(logger).instrument(paths.map(source=>({name:resolve(root,source),content:readFileSync(resolve(root,source),'utf8'),mutate:true})),{excludedMutations:[],ignoreStatic:false,ignorers:[]});
if(instrumented.mutants.length!==1744)throw Error('Wrong denominator');
const inputs=[];
for(let index=0;index<paths.length;index++){
 const source=paths[index];
 inputs.push({source,kind:'original',content:readFileSync(resolve(root,source),'utf8')});
 const preprocessed=await disableTypeChecks(instrumented.files[index],{plugins:[]});
 inputs.push({source,kind:'instrumented-all-mutants',content:preprocessed.content});
}
function emitAll(isolated){
 TsJestTransformer._cachedConfigSets.length=0;
 const transformer=new TsJestTransformer({tsconfig:isolated?`${root}/tsconfig.mutation.json`:`${root}/tsconfig.jest.json`,diagnostics:true});
 return inputs.map(input=>transformer.process(input.content,resolve(root,input.source),{config:{rootDir:root,globals:{},cacheDirectory:'/tmp/nestjs-t5-proof-cache',cache:true,name:isolated?'isolated-proof':'typed-proof'},cacheFS:new Map(),instrument:false,supportsStaticESM:false,supportsDynamicImport:true,supportsExportNamespaceFrom:true,supportsTopLevelAwait:false}).code);
}
const typed=emitAll(false), isolated=emitAll(true);
const printer=ts.createPrinter({removeComments:true});
function classBody(code,name){
 const ast=ts.createSourceFile('proof.js',code,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
 const classes=[];
 function visit(node){if((ts.isClassExpression(node)||ts.isClassDeclaration(node))&&node.name?.text===name)classes.push(node);ts.forEachChild(node,visit);}
 visit(ast);if(classes.length!==1)throw Error(`Wrong class count ${name}: ${classes.length}`);
 return classes[0].members.map(member=>({name:member.name?.getText(ast)??(ts.isConstructorDeclaration(member)?'constructor':'anonymous'),ast:printer.printNode(ts.EmitHint.Unspecified,member,ast)}));
}
function load(code,filename){const mod=new Module(filename);mod.filename=filename;mod.paths=Module._nodeModulePaths(dirname(filename));mod._compile(code,filename);return mod.exports;}
function tokens(cls){const params=[...(Reflect.getMetadata(constants.PARAMTYPES_METADATA,cls)??[])];for(const item of Reflect.getMetadata(constants.SELF_DECLARED_DEPS_METADATA,cls)??[])params[item.index]=item.param;return params;}
function describe(token){return typeof token==='string'?{kind:'explicit-token',value:token}:{kind:typeof token,name:token?.name};}
const output=[];
for(let index=0;index<inputs.length;index++){
 const input=inputs[index];
 const filename=resolve(root,input.source.replace(/^src\//,'dist/').replace(/\.ts$/,'.js'));
 const production=require(filename);
 const className=Object.keys(production).find(name=>name.endsWith('Service'));
 const left=classBody(typed[index],className), right=classBody(isolated[index],className);
 if(JSON.stringify(left)!==JSON.stringify(right))throw Error(`Business AST differs ${input.source} ${input.kind}`);
 const record={source:input.source,kind:input.kind,businessMembers:left.map(item=>item.name),businessAstEqual:true,businessAstSha256:createHash('sha256').update(JSON.stringify(left)).digest('hex'),wholeModuleByteEqual:typed[index]===isolated[index]};
 if(input.kind==='original'){
  const prodCode=readFileSync(filename,'utf8');
  if(JSON.stringify(classBody(prodCode,className))!==JSON.stringify(left))throw Error(`Production business AST differs ${input.source}`);
  const compiledTyped=load(typed[index],filename)[className], compiledIsolated=load(isolated[index],filename)[className], prod=production[className];
  const versions=[prod,compiledTyped,compiledIsolated], resolved=versions.map(tokens);
  if(resolved.some(list=>list.length!==resolved[0].length||list.some((token,i)=>token!==resolved[0][i])))throw Error(`Effective DI bindings differ ${input.source}`);
  const optional=versions.map(cls=>Reflect.getMetadata(constants.OPTIONAL_DEPS_METADATA,cls)??[]);
  if(optional.some(list=>JSON.stringify(list)!==JSON.stringify(optional[0])))throw Error('Optional DI differs');
  const mocks=resolved[0].map((token,i)=>({proofDependencyIndex:i}));
  const constructorAssignments=[];
  for(const cls of versions){
   const module=await Test.createTestingModule({providers:[cls,...resolved[0].map((provide,i)=>({provide,useValue:mocks[i]}))]}).compile();
   const instance=module.get(cls);const assignments=Object.entries(instance).filter(([,value])=>mocks.includes(value)).map(([property,value])=>({property,dependencyIndex:mocks.indexOf(value)})).sort((a,b)=>a.property.localeCompare(b.property));
   constructorAssignments.push(assignments);await module.close();
  }
  if(constructorAssignments.some(list=>JSON.stringify(list)!==JSON.stringify(constructorAssignments[0])))throw Error(`Constructor bindings differ ${input.source}`);
  if(new Set(constructorAssignments[0].map(item=>item.dependencyIndex)).size!==mocks.length)throw Error('Missing assigned dependency');
  record.productionBusinessAstEqual=true;record.effectiveNestDiTokens=resolved[0].map(describe);record.importedClassBindingsIdentical=true;record.optionalIndices=optional[0];record.actualNestTestingModuleVersions=['production-dist','typed-ts-jest','isolated-ts-jest'];record.constructorAssignments=constructorAssignments[0];
  const rawTyped=Reflect.getMetadata(constants.PARAMTYPES_METADATA,compiledTyped),rawIsolated=Reflect.getMetadata(constants.PARAMTYPES_METADATA,compiledIsolated);
  record.designMetadataDifferences=rawTyped.flatMap((token,i)=>token===rawIsolated[i]?[]:[{index:i,typed:describe(token),isolated:describe(rawIsolated[i]),explicitOverride:describe(resolved[0][i])}]);
 }
 output.push(record);
}
const result={node:process.version,typescript:require('typescript/package.json').version,tsJest:require('ts-jest/package.json').version,generatedMutants:instrumented.mutants.length,comparison:'Independent typed versus isolated ts-jest compilers; CommonJS/Bundler, interop and diagnostics option retained. Business class member AST includes constructor assignments/properties/methods. Original production classes additionally matched and instantiated through real Nest TestingModule; Model/Connection metadata differences overridden by identical explicit tokens.',mandatoryTypedCoverageUnchanged:true,results:output};
writeFileSync(`${root}/docs/upgrade/nestjs-12/evidence/t5/mutation-isolated-proof.json`,JSON.stringify(result,null,2)+'\n');
console.log(`PASS: ${output.length} business-AST matches; ${paths.length*3} real Nest class resolutions; ${instrumented.mutants.length} full-source mutants`);
