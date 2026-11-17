/** Read-only parser-time CSS from a verified published match. */
export function applyPublishedMatchFirstPaint(
 html:string,payload:unknown,expectedId:string
):string;

/** Hydrate from the server's verified public match read, or leave the API fallback intact. */
export function applyPublishedMatchDocument(
 html:string,payload:unknown,expectedId:string
):string;
