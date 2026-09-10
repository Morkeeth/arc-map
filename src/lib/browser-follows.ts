import { projects } from "./projects";

export const projectIdForAddress = (address: string) => projects.find(p => p.contract?.toLowerCase() === address.toLowerCase())?.id ?? `arc:${address.toLowerCase()}`;

/** Establish the cookie first, then migrate both former browser-only watchlists. */
export async function loadBrowserFollows() {
  const read = async (body?: unknown) => {
    const response = await fetch("/api/follows", body ? {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)} : {cache:"no-store"});
    if(!response.ok) throw new Error("Saved follows unavailable.");
    return response.json();
  };
  let data = await read();
  let migrationError = false;
  try {
    if (!localStorage.getItem("arcmap.follows.migrated.v3")) {
      const ids = new Set<string>();
      const oldProjects: unknown = JSON.parse(localStorage.getItem("arcmap.projects.v1") || "[]");
      const oldAddresses: unknown = JSON.parse(localStorage.getItem("arcmap.following.v1") || "[]");
      if(Array.isArray(oldProjects)) for(const id of oldProjects) if(typeof id === "string" && (projects.some(p=>p.id===id) || /^arc:0x[0-9a-f]{40}$/.test(id))) ids.add(id);
      if(Array.isArray(oldAddresses)) for(const address of oldAddresses) if(typeof address === "string" && /^0x[0-9a-fA-F]{40}$/.test(address)) ids.add(projectIdForAddress(address));
      if(ids.size > 100) throw new Error("Too many legacy follows to import at once.");
      for(const projectId of ids) if(!data.follows.some((f:{projectId:string})=>f.projectId===projectId)) data=await read({action:"follow",projectId});
      localStorage.setItem("arcmap.follows.migrated.v3","true");
    }
  } catch { migrationError=true; }
  return {data,migrationError};
}
