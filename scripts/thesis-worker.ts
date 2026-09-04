import { ThesisStore, checkThesis } from "../src/lib/thesis-store";
import { mkdirSync, writeFileSync } from "node:fs";
async function cycle() {
  const store=new ThesisStore(); let checked=0,failed=0;
  try {
    for(const item of store.due()) {
      try {await checkThesis(store,item.owner,item.id,true);checked++;}
      catch {failed++;}
    }
  } finally {store.close();}
  const status={at:new Date().toISOString(),checked,failed,mode:"finite read-only thesis checks; no signing"};
  mkdirSync(".data",{recursive:true}); writeFileSync(".data/thesis-worker-status.json",JSON.stringify(status),{mode:0o600});
  console.log(JSON.stringify(status));
}
async function main(){await cycle();if(process.argv.includes("--watch"))setInterval(()=>void cycle().catch(()=>console.error("Thesis worker cycle failed.")),60000);}
main().catch(()=>{console.error("Thesis worker stopped.");process.exitCode=1;});
