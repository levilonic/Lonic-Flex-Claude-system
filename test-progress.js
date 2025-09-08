const cliProgress = require('cli-progress');

console.log('Starting progress test...');

// Create progress bar
const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);

// Start the progress bar
bar.start(100, 0);
console.log('Progress bar started');

// Simulate progress
let progress = 0;
const timer = setInterval(() => {
    progress += 10;
    bar.update(progress);
    console.log(`Progress: ${progress}%`);
    
    if (progress >= 100) {
        bar.stop();
        console.log('\nComplete!');
        clearInterval(timer);
    }
}, 200);