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
 expect(api.loadApprovedSnapshot()).toBeNull();
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
