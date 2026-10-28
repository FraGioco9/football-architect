import reviewCandidate from '../catalogues/season-1.candidate.json' with {type:'json'};
import clubs from '../../data/clubs.json' with {type:'json'};
import selection from '../catalogues/season-1.participants.json' with {type:'json'};
import divisions from '../../data/divisions.json' with {type:'json'};
import cups from '../../data/international-competitions.json' with {type:'json'};
import {expect,it} from 'vitest';
import * as api from '../src/catalogue-snapshot.ts';
import {syntheticCatalogue,syntheticManifest} from './fixtures/synthetic-approval.ts';
it('accepts only exact trusted identities, eighteen bindings and full canonical rule hashes',async()=>{
 const manifest=await syntheticManifest(api),catalogue=syntheticCatalogue();
 const approved=await api.validateApprovedSnapshot(manifest,catalogue);
 expect(approved.bindings).toHaveLength(18);expect(approved.participantsHash).toMatch(/^[a-f0-9]{64}$/);
 expect(Object.isFrozen(approved)).toBe(true);expect(Object.isFrozen(approved.bindings[0].clubIds)).toBe(true);
 // Caller mutation must not rewrite a previously validated snapshot.
 manifest.bindings[0].clubIds[0]='UNKNOWN-1';expect(approved.bindings[0].clubIds[0]).toBe('IT-1');
});
it('rejects malformed, corrupt, incomplete and mismatched manifests without granting approval',async()=>{
 const original=await syntheticManifest(api),catalogue=syntheticCatalogue();
 const mutations=[
 (m:any)=>{m.manifestVersion=2},(m:any)=>{m.approvalReference=''},(m:any)=>{m.approved=true},
 (m:any)=>{m.participantsHash='0'.repeat(64)},(m:any)=>{m.rulesHash='0'.repeat(64)},
 (m:any)=>{m.bindings.pop()},(m:any)=>{m.bindings[1]=m.bindings[0]},
 (m:any)=>{m.bindings[0].rulesVersion='unknown'},(m:any)=>{m.bindings[0].clubIds[0]='XX-1'},
 (m:any)=>{m.bindings[0].clubIds[0]='IT-17'},(m:any)=>{m.bindings[0].clubIds[0]='IT-2'},
 (m:any)=>{m.bindings[16].clubIds.pop()},(m:any)=>{m.bindings[17].clubIds=[...m.bindings[16].clubIds]},
 ];
 for(const mutate of mutations){const m=structuredClone(original);mutate(m);await expect(api.validateApprovedSnapshot(m,catalogue)).rejects.toMatchObject({status:422})}
 const changed=structuredClone(catalogue);changed.competitions[0].rules={...changed.competitions[0].rules,points:2};
 await expect(api.validateApprovedSnapshot(original,changed)).rejects.toMatchObject({status:422});
 await expect(api.validateApprovedSnapshot(original,{...catalogue,clubIds:catalogue.clubIds.slice(1)})).rejects.toMatchObject({status:422});
});
it('binds hashes deterministically despite object-key order and detects participant/rule changes',async()=>{
 const manifest=await syntheticManifest(api),catalogue=syntheticCatalogue();
 const reversed={clubIds:[...catalogue.clubIds].reverse(),competitions:[...catalogue.competitions].reverse()};
 expect(await api.snapshotHashes(manifest.bindings,reversed)).toEqual({participantsHash:manifest.participantsHash,rulesHash:manifest.rulesHash});
});

it('Season 1-only allocation accepts owner-approved 1–3 / 4–6 and rejects synthetic 5–7',async()=>{
 const synthetic=await syntheticManifest(api);
 expect(()=>api.validateSeasonOneParticipants(synthetic.bindings)).toThrow();
 const seasonOne=structuredClone(synthetic.bindings);
 const federation=seasonOne.find(b=>b.competitionId==='int-2');
 if(!federation)throw new Error('missing Federation binding');
 federation.clubIds=['IT','ENG','ES','DE','FR','PT','NL','BR'].flatMap(country=>[4,5,6].map(n=>`${country}-${n}`));
 expect(()=>api.validateSeasonOneParticipants(seasonOne)).not.toThrow();
 const wrong=structuredClone(seasonOne);
 wrong.find(b=>b.competitionId==='int-1')!.clubIds[0]='IT-4';
 expect(()=>api.validateSeasonOneParticipants(wrong)).toThrow();
});

it('rejects malformed Season 1 selections with structured catalogue errors',()=>{
 for(const bindings of [null,{},Array(18).fill(null),Array(18).fill({competitionId:'IT-1'})])
  expect(()=>api.validateSeasonOneParticipants(bindings as any)).toThrowError(expect.objectContaining({status:422,code:'catalogue_not_approved'}));
});

it('later-season snapshot validation permits certified cross-tier changes without applying Season 1 ranges',async()=>{
 const manifest=await syntheticManifest(api),catalogue=syntheticCatalogue();
 const top=manifest.bindings.find(b=>b.competitionId==='IT-1')!;
 const second=manifest.bindings.find(b=>b.competitionId==='IT-2')!;
 top.clubIds[15]='IT-17';second.clubIds[0]='IT-16';
 Object.assign(manifest,await api.snapshotHashes(manifest.bindings,catalogue));
 await expect(api.validateApprovedSnapshot(manifest,catalogue)).resolves.toBeTruthy();
 await expect(api.validateApprovedSeasonOneSnapshot(manifest,catalogue)).rejects.toMatchObject({status:422});
});

it('complete Season 1 path binds actual selection to all canonical rules and independent Python hashes without enabling production',async()=>{
 const catalogue:api.CanonicalCatalogue={clubIds:clubs.map(c=>`${c.countryId}-${c.clubId}`),competitions:[...divisions,...cups].map(c=>({id:c.id,rulesVersion:c.rules.version,rules:JSON.parse(JSON.stringify(c.rules))}))};
 const bindings=selection.bindings.map(b=>({...b,rulesVersion:catalogue.competitions.find(c=>c.id===b.competitionId)!.rulesVersion}));
 const hashes=await api.snapshotHashes(bindings,catalogue);
 expect(hashes).toEqual({participantsHash:'d31b39b48190eed3e165931be573391d17298321fdb3ca71e922346aa3749d1a',rulesHash:'a87d7e02bb8045a4b081ca5b8b7c6d2032736f0efb4238f99032b6f638a8a67a'});
 const manifest={manifestVersion:1,approvalReference:'test-only:canonical-reconciliation-not-production-approval',bindings,...hashes};
 const approved=await api.validateApprovedSeasonOneSnapshot(manifest,catalogue);
 expect(approved.bindings).toHaveLength(18);expect(Object.isFrozen(approved)).toBe(true);
 // Selection-only input, corrupt approval hash, full-rule drift and old synthetic slots all fail closed.
 await expect(api.validateApprovedSeasonOneSnapshot(selection,catalogue)).rejects.toMatchObject({status:422});
 await expect(api.validateApprovedSeasonOneSnapshot({...manifest,rulesHash:'0'.repeat(64)},catalogue)).rejects.toMatchObject({status:422});
 const changed=structuredClone(catalogue);(changed.competitions[0].rules as Record<string,unknown>).schemaVersion=2;
 await expect(api.validateApprovedSeasonOneSnapshot(manifest,changed)).rejects.toMatchObject({status:422});
 const synthetic=await syntheticManifest(api);
 await expect(api.validateApprovedSeasonOneSnapshot(synthetic,syntheticCatalogue())).rejects.toMatchObject({status:422});
});

// The candidate is real review input, not an executable approval or positive fixture.
it('pending canonical Season 1 candidate never grants production approval',async()=>{
 const catalogue:api.CanonicalCatalogue=JSON.parse(JSON.stringify(reviewCandidate.catalogue));
 await expect(api.validateApprovedSeasonOneSnapshot(reviewCandidate,catalogue)).rejects.toMatchObject({status:422,code:'catalogue_not_approved'});
 await expect(api.validateApprovedSeasonOneSnapshot(reviewCandidate.manifest,catalogue)).rejects.toMatchObject({status:422,code:'catalogue_not_approved'});
 expect(()=>api.requireApprovedSnapshot(reviewCandidate.manifest as any)).toThrow();
});
