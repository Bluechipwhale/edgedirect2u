import {afterEach,expect,it,vi} from 'vitest';
import {metresBetween,readFieldLocation,storeRadius} from '../src/lib/field-location';
const point=(accuracy=5,lat=6.5,timestamp=Date.now())=>({coords:{latitude:lat,longitude:3.4,accuracy},timestamp}) as GeolocationPosition;
function fixture(){let success:PositionCallback;let failure:PositionErrorCallback|null;const geo={watchPosition:vi.fn((s:PositionCallback,e?:PositionErrorCallback|null)=>{success=s;failure=e||null;return 7;}),clearWatch:vi.fn()};return {geo,send:(p:GeolocationPosition)=>success(p),fail:(code:number)=>failure?.({code} as GeolocationPositionError)};}
afterEach(()=>vi.useRealTimers());
it('waits for an accurate fresh fix and clears location tracking after success',async()=>{
 const f=fixture(),progress=vi.fn(),result=readFieldLocation(f.geo,{onProgress:progress,target:{latitude:6.5,longitude:3.4,radius:50}});
 f.send(point(5,6.5,Date.now()-120000));expect(progress).not.toHaveBeenCalled();f.send(point(150));f.send(point(20));
 expect((await result).accuracy).toBe(20);expect(f.geo.clearWatch).toHaveBeenCalledWith(7);expect(f.geo.watchPosition.mock.calls[0]).toHaveLength(3);
});
it('rejects an imprecise timeout and reports how to enable precise GPS',async()=>{
 vi.useFakeTimers();const f=fixture(),result=readFieldLocation(f.geo);const rejection=expect(result).rejects.toThrow('Enable precise location');f.send(point(200));await vi.advanceTimersByTimeAsync(30000);await rejection;expect(f.geo.clearWatch).toHaveBeenCalledWith(7);
});
it('cancels the location watch when the user leaves the screen',async()=>{
 const f=fixture(),controller=new AbortController(),result=readFieldLocation(f.geo,{signal:controller.signal});controller.abort();await expect(result).rejects.toMatchObject({name:'AbortError'});expect(f.geo.clearWatch).toHaveBeenCalledWith(7);
});
it('explains denied location permission without supplying any fallback coordinate',async()=>{
 const f=fixture(),result=readFieldLocation(f.geo);f.fail(1);await expect(result).rejects.toThrow('Location permission was denied');expect(f.geo.clearWatch).toHaveBeenCalledWith(7);
});
it('uses the approved 100m company boundary despite smaller or larger legacy overrides',()=>{
 expect(storeRadius({id:'10000000-0000-4000-8000-000000000001',geofence_metres:100},{radius_metres:1000})).toBe(100);
 expect(storeRadius({id:'10000000-0000-4000-8000-000000000001',geofence_metres:100},{radius_metres:50})).toBe(100);
 expect(storeRadius({id:'other-company',geofence_metres:100},{radius_metres:150})).toBe(150);
 const distance=metresBetween({latitude:6.5,longitude:3.4},{latitude:6.501,longitude:3.4});expect(distance).toBeGreaterThan(110);expect(distance).toBeLessThan(112);
});
