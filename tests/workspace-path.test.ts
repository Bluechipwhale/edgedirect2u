import {it,expect} from 'vitest';
import {workspacePath} from '../src/lib/workspace-path';
it('keeps company sign-in within known local workspaces',()=>{
  for(const p of ['/platform','/platform/security','/company/e-edge-direct-2u','/field/company-a','/workspaces'])expect(workspacePath(p)).toBe(p);
  for(const p of ['//example.com','https://example.com','/\\example.com','/company/a?next=https://example.com','/company/../admin','/platform#x',undefined,['/platform']])expect(workspacePath(p)).toBeUndefined();
});
