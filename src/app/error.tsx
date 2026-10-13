'use client';
export default function Page({reset}:{reset:()=>void}){return <div className="container narrow-page"><h1>A little pause.</h1><p>We couldn’t load this page. Please try again.</p><button className="button" onClick={reset}>Try again</button></div>;}
