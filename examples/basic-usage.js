#!/usr/bin/env node

/**
 * Basic usage example for modern-patch-package
 * 
 * This example demonstrates how to use the modern-patch-package
 * programmatically in your Node.js applications.
 */

const { ModernPatchPackage } = require('../dist/index');

async function main() {
  console.log('🚀 Modern Patch Package - Basic Usage Example\n');

  try {
    // Create a new patch package instance
    const patcher = new ModernPatchPackage({
      patchDir: 'examples/patches'
    });

    console.log('1. Listing existing patches...');
    const patches = await patcher.listPatches();
    
    if (patches.length === 0) {
      console.log('   No patches found.');
    } else {
      console.log(`   Found ${patches.length} patch(es):`);
      patches.forEach(patch => {
        console.log(`   - ${patch.packageName}@${patch.packageVersion}`);
      });
    }

    console.log('\n2. Applying patches...');
    const applyResult = await patcher.applyPatches();
    
    if (applyResult.success) {
      console.log(`   ✓ Applied ${applyResult.patchesApplied.length} patch(es) successfully`);
    } else {
      console.log(`   ✗ Failed to apply ${applyResult.errors.length} patch(es)`);
      applyResult.errors.forEach(error => {
        console.log(`     - ${error}`);
      });
    }

    console.log('\n3. Example: Creating a patch for a package');
    console.log('   (This would create a patch if the package exists)');
    
    // This is just an example - the package might not exist
    const createResult = await patcher.createPatch('example-package');
    
    if (createResult.success) {
      console.log('   ✓ Patch created successfully');
      console.log(`   Created: ${createResult.patchesCreated.join(', ')}`);
    } else {
      console.log('   ✗ Failed to create patch (this is expected for non-existent packages)');
      console.log('   This is normal if the package doesn\'t exist in node_modules');
    }

    console.log('\n✅ Example completed successfully!');
    console.log('\nTo use this in your project:');
    console.log('1. Install: npm install modern-patch-package');
    console.log('2. Add to package.json scripts: "postinstall": "modern-patch-package apply"');
    console.log('3. Create patches: npx modern-patch-package create <package-name>');
    console.log('4. Apply patches: npx modern-patch-package apply');

  } catch (error) {
    console.error('❌ Error running example:', error.message);
    process.exit(1);
  }
}

// Run the example
if (require.main === module) {
  main();
}

module.exports = { main }; 