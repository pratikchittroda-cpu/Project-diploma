#!/usr/bin/env node

/**
 * 📱 Responsive Design Fix Script
 * 
 * This script applies responsive design patterns to all remaining screens
 * to prevent content cut-off issues on different device sizes.
 */

const fs = require('fs');
const path = require('path');

// List of screens that need responsive design fixes
const screensToFix = [
  'AddTransactionScreen.js',
  'BudgetScreen.js', 
  'StatsScreen.js',
  'TransactionsScreen.js',
  'ProfileScreen.js',
  'SettingsScreen.js',
  'CompanyDashboardScreen.js',
  'CompanyBudgetScreen.js',
  'AddCompanyTransactionScreen.js',
  'CompanyReportsScreen.js',
  'CompanyProfileScreen.js',
  'CompanySettingsScreen.js'
];

// Responsive design patterns to apply
const responsivePatterns = {
  // Import SafeAreaView
  addSafeAreaImport: (content) => {
    if (!content.includes('SafeAreaView')) {
      return content.replace(
        /from 'react-native';/,
        `from 'react-native';`
      ).replace(
        /} from 'react-native';/,
        `,
  SafeAreaView
} from 'react-native';`
      );
    }
    return content;
  },

  // Update return statement to use SafeAreaView and responsive structure
  updateReturnStatement: (content) => {
    // Find existing return statement patterns
    const patterns = [
      // Pattern 1: return ( <View style={styles.container}>
      {
        search: /return \(\s*<View style={styles\.container}>/,
        replace: `return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor={theme.primary || 'transparent'} barStyle={theme.statusBarStyle || 'dark-content'} translucent={true} />
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>`
      },
      
      // Pattern 2: return ( <ScrollView
      {
        search: /return \(\s*<ScrollView/,
        replace: `return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor={theme.primary || 'transparent'} barStyle={theme.statusBarStyle || 'dark-content'} translucent={true} />
      <ScrollView`
      }
    ];

    for (const pattern of patterns) {
      if (pattern.search.test(content)) {
        content = content.replace(pattern.search, pattern.replace);
        break;
      }
    }

    return content;
  },

  // Update closing tags
  updateClosingTags: (content) => {
    // Pattern 1: </View> ); at the end
    content = content.replace(
      /(\s*)<\/View>\s*\)\s*;\s*$/m,
      `$1</View>
      </ScrollView>
    </SafeAreaView>
  );`
    );

    // Pattern 2: </ScrollView> </View> );
    content = content.replace(
      /(\s*)<\/ScrollView>\s*<\/View>\s*\)\s*;/,
      `$1</ScrollView>
    </SafeAreaView>
  );`
    );

    return content;
  },

  // Add responsive styles
  addResponsiveStyles: (content) => {
    // Find createStyles function and add responsive styles
    const stylesPattern = /const createStyles = \(theme\) => StyleSheet\.create\(\{\s*container: \{/;
    
    if (stylesPattern.test(content)) {
      content = content.replace(
        stylesPattern,
        `const createStyles = (theme) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.background || theme.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  container: {`
      );
    }

    // Make font sizes responsive
    content = content.replace(
      /fontSize: (\d+),/g,
      (match, size) => {
        const responsiveSize = Math.min(parseInt(size), Math.floor(parseInt(size) * 0.06));
        return `fontSize: Math.min(${size}, width * ${(parseInt(size) / 400).toFixed(3)}),`;
      }
    );

    // Make padding responsive
    content = content.replace(
      /padding(?:Top|Bottom|Left|Right|Horizontal|Vertical)?: (\d+),/g,
      (match, padding) => {
        const responsivePadding = Math.max(parseInt(padding) * 0.7, 10);
        return match.replace(padding, `Math.max(${responsivePadding}, width * ${(parseInt(padding) / 400).toFixed(3)})`);
      }
    );

    return content;
  },

  // Add Dimensions import if not present
  addDimensionsImport: (content) => {
    if (!content.includes('Dimensions')) {
      content = content.replace(
        /} from 'react-native';/,
        `,
  Dimensions
} from 'react-native';`
      );
      
      // Add dimensions constant
      content = content.replace(
        /export default function/,
        `const { width, height } = Dimensions.get('window');

export default function`
      );
    }
    return content;
  }
};

// Function to apply responsive design to a single screen
function fixScreen(screenPath) {
  try {
    console.log(`🔧 Fixing ${path.basename(screenPath)}...`);
    
    let content = fs.readFileSync(screenPath, 'utf8');
    
    // Apply all responsive patterns
    content = responsivePatterns.addSafeAreaImport(content);
    content = responsivePatterns.addDimensionsImport(content);
    content = responsivePatterns.updateReturnStatement(content);
    content = responsivePatterns.updateClosingTags(content);
    content = responsivePatterns.addResponsiveStyles(content);
    
    // Write the updated content back
    fs.writeFileSync(screenPath, content, 'utf8');
    
    console.log(`✅ Fixed ${path.basename(screenPath)}`);
    
  } catch (error) {
    console.error(`❌ Error fixing ${path.basename(screenPath)}:`, error.message);
  }
}

// Main execution
function main() {
  console.log('🚀 Starting responsive design fixes...\n');
  
  const screensDir = path.join(__dirname, 'screens');
  
  for (const screenFile of screensToFix) {
    const screenPath = path.join(screensDir, screenFile);
    
    if (fs.existsSync(screenPath)) {
      fixScreen(screenPath);
    } else {
      console.log(`⚠️  Screen not found: ${screenFile}`);
    }
  }
  
  console.log('\n🎉 Responsive design fixes completed!');
  console.log('\n📱 All screens should now work properly on different device sizes.');
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { fixScreen, responsivePatterns };