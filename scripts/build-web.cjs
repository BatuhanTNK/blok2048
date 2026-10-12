const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),out=path.join(root,'www');
fs.mkdirSync(out,{recursive:true});
let html=fs.readFileSync(path.join(root,'index.html'),'utf8');
// Bundle all game assets locally for the Android offline build.
html=html.replace(/<link[^>]*href="https:[^"]*fonts\.(?:googleapis|gstatic)\.com[^>]*>/g,'');
fs.writeFileSync(path.join(out,'index.html'),html);
fs.cpSync(path.join(root,'src'),path.join(out,'src'),{recursive:true});
console.log('Offline web bundle ready.');
