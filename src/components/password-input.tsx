'use client';
import {useState,type InputHTMLAttributes} from 'react';
import {Eye,EyeOff} from 'lucide-react';

export function PasswordInput({label='password',...props}:Omit<InputHTMLAttributes<HTMLInputElement>,'type'> & {label?:string}){
  const [visible,setVisible]=useState(false);
  return <span className="password-input"><input {...props} type={visible?'text':'password'}/><button type="button" className="password-toggle" aria-label={`${visible?'Hide':'Show'} ${label}`} aria-pressed={visible} onClick={event=>{event.preventDefault();setVisible(value=>!value);}}>{visible?<EyeOff size={19} aria-hidden="true"/>:<Eye size={19} aria-hidden="true"/>}</button></span>;
}
