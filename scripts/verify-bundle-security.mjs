import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve('dist/assets');
const files = fs.readdirSync(dir);

let mainBundleFile = files.find(f => f.startsWith('index-') && f.endsWith('.js'));
if (!mainBundleFile) {
  console.error('Could not find index-*.js in dist/assets');
  process.exit(1);
}

const mainBundleContent = fs.readFileSync(path.join(dir, mainBundleFile), 'utf-8');

console.log(`--- Inspecting Participant / Main Bundle: ${mainBundleFile} (${mainBundleContent.length} bytes) ---`);

const checks = [
  'STRIKE1_KEY',
  'calculatePredictScore',
  'q1-01":{answer',
  'q1-01":{',
  'private_answers',
  'correctAnswer',
];

let leak = false;
for (const check of checks) {
  const found = mainBundleContent.includes(check);
  console.log(`Check "${check}": ${found ? 'FOUND (LEAK!)' : 'NOT FOUND (CLEAN)'}`);
  if (found) leak = true;
}

const hasAnswerMapping = /q1-01.*?answer.*?A/i.test(mainBundleContent);
console.log(`Regex /q1-01.*?answer.*?A/: ${hasAnswerMapping ? 'FOUND (LEAK!)' : 'NOT FOUND (CLEAN)'}`);
if (hasAnswerMapping) leak = true;

// Also inspect ALL chunks that are NOT organizer chunks
console.log('\n--- Inspecting All Participant Accessible Chunks ---');
const participantChunks = files.filter(f => 
  f.endsWith('.js') && 
  !f.startsWith('Submissions-') && 
  !f.startsWith('Overview-') && 
  !f.startsWith('RoundControl-') && 
  !f.startsWith('TeamManagement-') && 
  !f.startsWith('JudgeManagement-') && 
  !f.startsWith('LiveMonitoring-') && 
  !f.startsWith('SessionManagement-') && 
  !f.startsWith('SystemStatus-') && 
  !f.startsWith('Results-') &&
  !f.startsWith('AssignedTeams-') &&
  !f.startsWith('TeamSubmissions-') &&
  !f.startsWith('Evaluation-') &&
  !f.startsWith('OrganizerLayout-') &&
  !f.startsWith('JudgeLayout-') &&
  !f.startsWith('OrganizerLogin-') &&
  !f.startsWith('JudgeLogin-')
);

for (const chunk of participantChunks) {
  const chunkContent = fs.readFileSync(path.join(dir, chunk), 'utf-8');
  for (const check of checks) {
    if (chunkContent.includes(check)) {
      console.error(`LEAK in ${chunk}: Found "${check}"`);
      leak = true;
    }
  }
}

// Check source maps
const sourceMaps = files.filter(f => f.endsWith('.map'));
console.log(`Source maps present: ${sourceMaps.length > 0 ? 'YES (UNSAFE)' : 'NO (SECURE)'}`);
if (sourceMaps.length > 0) leak = true;

if (leak) {
  console.error('\nFAILED: Answer key is exposed to participant!');
  process.exit(1);
} else {
  console.log('\n✓ ALL CHECKS PASSED: Zero Strike 1 answer keys exist in participant-accessible bundles!');
}
