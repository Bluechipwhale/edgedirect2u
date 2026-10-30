export function isChunkFailure(message:string){return /ChunkLoadError|Loading (?:CSS )?chunk .+ failed|Failed to fetch dynamically imported module|Importing a module script failed/i.test(message);}
export function shouldRecoverChunk(message:string,lastAttempt:number,now:number){return isChunkFailure(message)&&Number.isFinite(lastAttempt)&&now-lastAttempt>120000;}
