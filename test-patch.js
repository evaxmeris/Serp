
// Monkey patch String.repeat to catch negative count calls
if (typeof String.prototype.repeat !== 'undefined') {
  const originalRepeat = String.prototype.repeat;
  String.prototype.repeat = function(count) {
    if (count < 0) {
      console.error('!!! String.repeat called with negative count:', count);
      console.error('!!! Stack trace:');
      console.error(new Error().stack);
      // Return empty string instead of throwing
      return '';
    }
    return originalRepeat.call(this, count);
  };
  console.log('Monkey patch for String.repeat installed successfully');
}

console.log('Testing... calling "x".repeat(-6)');
console.log('Result:', JSON.stringify("x".repeat(-6)));
console.log('Done, no crash');
