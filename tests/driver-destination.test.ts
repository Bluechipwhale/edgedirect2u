import {it,expect} from 'vitest';
import {driverDestination} from '../src/lib/driver-destination';
it('opens the approved field workspace for van staff while keeping delivery drivers on their jobs',()=>{
 const companies=[{slug:'e-edge-direct-2u',role:'field_agent'}];
 expect(driverDestination('customer',companies,'van_sales')).toBe('/field/e-edge-direct-2u');
 expect(driverDestination('driver',companies)).toBeNull();
 expect(driverDestination('customer',[],'van_sales')).toBe('/staff');
 expect(driverDestination('admin',[],'administrator')).toBe('/workspaces');
 expect(driverDestination('customer',[])).toBeNull();
});
