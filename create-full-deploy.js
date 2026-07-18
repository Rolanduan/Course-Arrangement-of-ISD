import fs from 'fs';
import { ZipArchive } from 'archiver';

const output = fs.createWriteStream('deploy-full.zip');
const archive = new ZipArchive({ zlib: { level: 9 } });

archive.pipe(output);

// 添加前端文件
archive.directory('dist/', false);

// 添加 Netlify Functions (包括所有子目录)
archive.directory('netlify/functions/', 'netlify/functions/');

// 添加 server 目录
archive.directory('server/', 'server/');

// 添加 node_modules (必要的依赖)
archive.directory('node_modules/pg/', 'node_modules/pg/');
archive.directory('node_modules/mysql2/', 'node_modules/mysql2/');
archive.directory('node_modules/@netlify/', 'node_modules/@netlify/');

archive.finalize();

output.on('close', () => {
  console.log(`ZIP created: ${archive.pointer()} bytes`);
  process.exit(0);
});

archive.on('error', (err) => {
  console.error('Archive error:', err);
  process.exit(1);
});
