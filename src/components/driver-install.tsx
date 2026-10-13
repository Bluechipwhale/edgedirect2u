'use client';
import { useEffect } from 'react';
export function DriverInstall(){useEffect(()=>{if('serviceWorker' in navigator)navigator.serviceWorker.register('/driver-sw.js',{scope:'/'}).catch(()=>{});},[]);return <p className="help-text">Use your browser’s Install app or Add to Home Screen option. A connection is required for delivery details and updates.</p>;}
