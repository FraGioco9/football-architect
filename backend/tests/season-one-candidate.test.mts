import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm,mkdir,stat} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import * as tool from '../tools/season-one-candidate.mts';
import {validateApprovedSeasonOneSnapshot} from '../src/catalogue-snapshot.ts';
const root=fileURLToPath(new URL('../../',import.meta.url));
const cli=fileURLToPath(new URL('../tools/season-one-candidate.mts',import.meta.url));
const candidatePath=join(root,'backend/catalogues/season-1.candidate.json');

test('candidate records all canonical full rules and approved slots without granting approval',async()=>{
 const sources=await tool.readPinnedSeasonOneSources();
 const candidate=await tool.buildSeasonOneCandidate(sources);
 assert.equal(candidate.status,'pending-owner-review');assert.equal(candidate.productionApproval,false);
 assert.equal(candidate.manifest.approvalReference,null);
 assert.equal(candidate.sourceRevision,'c187d4ebfc0240515e79b4dbd9f3dceea3f293cc');
 assert.equal(candidate.manifest.participantsHash,'d31b39b48190eed3e165931be573391d17298321fdb3ca71e922346aa3749d1a');
 assert.equal(candidate.manifest.rulesHash,'a87d7e02bb8045a4b081ca5b8b7c6d2032736f0efb4238f99032b6f638a8a67a');
 assert.equal(candidate.catalogue.clubIds.length,320);assert.equal(candidate.catalogue.competitions.length,18);
 const federation=candidate.manifest.bindings.find(b=>b.competitionId==='int-2')!;
 assert.deepEqual(federation.clubIds.filter(id=>id.startsWith('IT-')),['IT-4','IT-5','IT-6']);
 for(const competition of candidate.catalogue.competitions){
  const original=[...JSON.parse(sources['data/divisions.json']),...JSON.parse(sources['data/international-competitions.json'])].find(c=>c.id===competition.id);
  assert.deepEqual(competition.rules,original.rules);
 }
 await assert.rejects(validateApprovedSeasonOneSnapshot(candidate.manifest,candidate.catalogue),{code:'catalogue_not_approved'});
 await tool.verifySeasonOneCandidate(candidate,sources);
});

test('candidate checker rejects tampering, self-approval, wrong selections and canonical input drift',async()=>{
 const sources=await tool.readPinnedSeasonOneSources(),candidate=await tool.buildSeasonOneCandidate(sources);
 const mutations=[
  (c:any)=>{c.productionApproval=true},(c:any)=>{c.manifest.approvalReference='owner-approved:forged'},
  (c:any)=>{c.catalogue.competitions.pop()},(c:any)=>{c.catalogue.competitions[0].rules.schemaVersion=2},
  (c:any)=>{c.sourceRevision='f'.repeat(40)},(c:any)=>{c.sources[0].sha256='0'.repeat(64)},
  (c:any)=>{c.manifest.bindings.find((b:any)=>b.competitionId==='int-2').clubIds[0]='IT-7'},
  (c:any)=>{c.extra='not allowed'},
 ];
 for(const mutate of mutations){const changed=structuredClone(candidate);mutate(changed);await assert.rejects(tool.verifySeasonOneCandidate(changed,sources))}
 for(const path of ['data/divisions.json','backend/catalogues/season-1.participants.json','assets/world-calendar-model.js']){
  const changed={...sources,[path]:sources[path]+'\n'};
  await assert.rejects(tool.verifySeasonOneCandidate(candidate,changed));
 }
 const missing={...sources};delete missing['data/clubs.json'];await assert.rejects(tool.buildSeasonOneCandidate(missing));
 const wrong=JSON.parse(sources['backend/catalogues/season-1.participants.json']);wrong.bindings.find((b:any)=>b.competitionId==='int-2').clubIds[0]='IT-7';
 await assert.rejects(tool.buildSeasonOneCandidate({...sources,'backend/catalogues/season-1.participants.json':JSON.stringify(wrong)}));
});

test('CLI check verifies committed bytes read-only and rejects approval/remote flags',async()=>{
 const before=await readFile(candidatePath),mtime=(await stat(candidatePath)).mtimeMs;
 const result=spawnSync(process.execPath,['--experimental-strip-types',cli,'--check'],{cwd:tmpdir(),encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/pending.owner.review/i);
 assert.deepEqual(await readFile(candidatePath),before);assert.equal((await stat(candidatePath)).mtimeMs,mtime);
 for(const flag of ['--approve','--remote','--write --approve']){
  const denied=spawnSync(process.execPath,['--experimental-strip-types',cli,...flag.split(' ')],{encoding:'utf8'});
  assert.notEqual(denied.status,0);assert.deepEqual(await readFile(candidatePath),before);
 }
});

test('pinned source loader works without Git history and refuses missing or edited files',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'fa-candidate-source-'));
 try{
  for(const [path,bytes] of Object.entries(await tool.readPinnedSeasonOneSources())){
   await mkdir(dirname(join(dir,path)),{recursive:true});await writeFile(join(dir,path),bytes);
  }
  await tool.readPinnedSeasonOneSources(dir);
  await writeFile(join(dir,'data/divisions.json'),'[]\n');
  await assert.rejects(tool.readPinnedSeasonOneSources(dir),/drift|mismatch/i);
  await rm(join(dir,'data/divisions.json'));
  await assert.rejects(tool.readPinnedSeasonOneSources(dir));
 }finally{await rm(dir,{recursive:true,force:true})}
});
