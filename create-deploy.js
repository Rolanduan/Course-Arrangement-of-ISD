import fs from 'fs';
import { ZipArchive } from 'archiver';

const output = fs.createWriteStream('deploy-correct.zip');
const archive = new ZipArchive({ zlib: { level: 9 } });

archive.pipe(output);

// 将 dist 目录内容添加到 zip 根目录
archive.directory('dist/', false);

archive.finalize();

output.on('close', () => {
  console.log(`ZIP created: ${archive.pointer()} bytes`);
  process.exit(0);
});

archive.on('error', (err) => {
  console.error('Archive error:', err);
  process.exit(1);
});
