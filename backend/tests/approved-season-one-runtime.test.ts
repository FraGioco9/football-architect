import {expect,it} from 'vitest';
import clubs from '../../data/clubs.json' with {type:'json'};
import divisions from '../../data/divisions.json' with {type:'json'};
import cups from '../../data/international-competitions.json' with {type:'json'};
import calendar from '../../assets/world-calendar-model.js';
import record from '../catalogues/season-1.approval.json' with {type:'json'};
import {loadApprovedSnapshot,validateProductionSeasonOneApproval} from '../src/approved-season-one.ts';
import {canonicalHash,requireApprovedSnapshot,snapshotHashes,type CanonicalCatalogue} from '../src/catalogue-snapshot.ts';
const catalogue=():CanonicalCatalogue=>({clubIds:clubs.map(c=>`${c.countryId}-${c.clubId}`),competitions:[...divisions,...cups].map(c=>({id:c.id,rulesVersion:c.rules.version,rules:JSON.parse(JSON.stringify(c.rules))}))});
const plan=()=>JSON.parse(JSON.stringify(calendar.createSeason(1)));
it('loads only the owner-approved immutable Season 1 manifest from independent canonical sources',async()=>{
 const snapshot=await loadApprovedSnapshot();expect(requireApprovedSnapshot(snapshot)).toBe(snapshot);
 expect(snapshot.participantsHash).toBe('d31b39b48190eed3e165931be573391d17298321fdb3ca71e922346aa3749d1a');
 expect(snapshot.rulesHash).toBe('a87d7e02bb8045a4b081ca5b8b7c6d2032736f0efb4238f99032b6f638a8a67a');
 expect(snapshot.approvalReference).toBe('owner:2026-10-28:season-1-review:8126da13d0f36a1a2087f66f21626d06fe00c873');
 expect(Object.isFrozen(snapshot)).toBe(true);expect(Object.isFrozen(snapshot.bindings[0].clubIds)).toBe(true);
 expect(snapshot.bindings.find(b=>b.competitionId==='int-2')!.clubIds.filter(id=>id.startsWith('IT-'))).toEqual(['IT-4','IT-5','IT-6']);
 expect(plan().days).toHaveLength(56);
});
it('rejects absent approval, forged references, changed source pins and calendar/rule/participant drift even after rehash',async()=>{
 for(const input of [null,{}, {...record,status:'pending-owner-review'},{...record,approvalReference:'forged'}])
  await expect(validateProductionSeasonOneApproval(input,catalogue(),plan())).rejects.toMatchObject({status:422,code:'catalogue_not_approved'});
 const mutations=[(r:any)=>{r.reviewedCandidateCommit='f'.repeat(40)},(r:any)=>{r.sources[0].sha256='0'.repeat(64)},(r:any)=>{r.manifest.approvalReference='another-owner'},(r:any)=>{r.calendarHash='0'.repeat(64)}];
 for(const mutate of mutations){const r=structuredClone(record);mutate(r);await expect(validateProductionSeasonOneApproval(r,catalogue(),plan())).rejects.toMatchObject({status:422})}
 const changed=catalogue();(changed.competitions[0].rules as any).schemaVersion=2;
 await expect(validateProductionSeasonOneApproval(record,changed,plan())).rejects.toMatchObject({status:422});
 const missingClub=catalogue();(missingClub.clubIds as string[]).pop();
 await expect(validateProductionSeasonOneApproval(record,missingClub,plan())).rejects.toMatchObject({status:422});
 const rehashed={...record,manifest:{...record.manifest,...await snapshotHashes(record.manifest.bindings,changed)}};
 await expect(validateProductionSeasonOneApproval(rehashed,changed,plan())).rejects.toMatchObject({status:422});
 const wrong=structuredClone(record);wrong.manifest.bindings.find(b=>b.competitionId==='int-2')!.clubIds[0]='IT-7';
 Object.assign(wrong.manifest,await snapshotHashes(wrong.manifest.bindings,catalogue()));
 await expect(validateProductionSeasonOneApproval(wrong,catalogue(),plan())).rejects.toMatchObject({status:422});
 const moved=plan();moved.days[52].events=[];
 await expect(validateProductionSeasonOneApproval(record,catalogue(),moved)).rejects.toMatchObject({status:422});
 await expect(validateProductionSeasonOneApproval({...record,calendarHash:await canonicalHash(moved)},catalogue(),moved)).rejects.toMatchObject({status:422});
});
