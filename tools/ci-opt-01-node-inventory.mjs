// CI-OPT-01: read-only static screen. No inference of proven parallel safety.
import {readdirSync,readFileSync} from "node:fs";
import {resolve} from "node:path";
const dir=resolve("tests");
const files=readdirSync(dir).filter(x=>x.endsWith(".test.mjs")).sort();
const signals={
 network:/createServer|\.listen\s*\(|127\.0\.0\.1|localhost/,
 filesystem:/mkdtemp|writeFile|rmSync|renameSync|unlinkSync|mkdirSync|copyFile|cpSync/,
 subprocess:/execFileSync|execSync|spawn\s*\(|fork\s*\(/,
 globalState:/process\.env|globalThis|process\.chdir/
};
const rows=files.map(name=>{
 const source=readFileSync(resolve(dir,name),"utf8");
 const found=Object.entries(signals).filter(([,re])=>re.test(source)).map(([name])=>name);
 return {file:"tests/"+name,signals:found,classification:found.length?"review-required":"candidate-only"};
});
const totals=Object.fromEntries(Object.keys(signals).map(key=>[key,rows.filter(x=>x.signals.includes(key)).length]));
const out={total:rows.length,totals,reviewRequired:rows.filter(x=>x.signals.length).length,candidates:rows.filter(x=>!x.signals.length).length,rows};
if(process.argv.includes("--json"))process.stdout.write(JSON.stringify(out,null,2)+"\n");
else console.log("Node test isolation inventory:",out.total,"files;",out.reviewRequired,"review-required;",out.candidates,"static candidates. No parallel-safe assertion.");
