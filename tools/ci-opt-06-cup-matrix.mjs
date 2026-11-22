// Run each independent INT24 cup in its own browser page/context. No width
// or view is omitted: widths execute serially for each cup. The bounded pair
// only overlaps distinct competitions, and waits for BOTH failures/successes
// before returning so concurrent QA errors cannot be silently discarded.
export async function runIndependentCupMatrix(cups,widths,visit){
 const maxConcurrent=2;
 for(let start=0;start<cups.length;start+=maxConcurrent){
  const group=cups.slice(start,start+maxConcurrent);
  const outcomes=await Promise.allSettled(group.map(async cup=>{
   for(const width of widths)await visit(cup,width);
  }));
  const failures=outcomes.flatMap((result,index)=>result.status==='rejected'
   ?[new Error('INT24 '+group[index]+' failed: '+String(result.reason?.message||result.reason),{cause:result.reason})]
   :[]);
  if(failures.length)throw new AggregateError(failures,'INT24 independent cup matrix failed');
 }
}
