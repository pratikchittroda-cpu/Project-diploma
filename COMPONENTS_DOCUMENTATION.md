# 🧩 Components Documentation - Reusable UI Elements

## 🎯 **What are Components?**
Components are reusable pieces of UI that can be used across multiple screens. Think of them as building blocks that make the app consistent and easier to maintain.

## 📁 **Components Folder Structure**
```
components/
├── 🎨 EnhancedButton.js         # Beautiful custom buttons
├── 📋 EnhancedCard.js           # Card containers with animations
├── ⌨️ KeyboardAwareContainer.js  # Handles keyboard interactions
├── 💬 ThemedMessageBox.js       # Custom alert/dialog boxes
├── 🔧 MessageBoxProvider.js     # Manages message boxes globally
└── 🛡️ UserTypeGuard.js          # Protects screens by user type
```

## 🎨 **EnhancedButton.js - Custom Button Component**

### **Purpose:**
Creates beautiful, animated buttons that look consistent throughout the app.

### **Key Features:**
```javascript
// Different button styles
variant = 'primary'    // Solid colored button
variant = 'outline'    // Border-only button  
variant = 'ghost'      // Text-only button

// Different sizes
size = 'sm'           // Small button
size = 'md'           // Medium button (default)
size = 'lg'           // Large button

// Special features
loading = true        // Shows loading spinner
disabled = true       // Grays out button
icon = "plus"         // Adds icon to button
gradient = ['#667eea', '#764ba2']  // Gradient background
```

### **Usage Example:**
```javascript
// Primary button with icon
<EnhancedButton
  title="Add Transaction"
  icon="plus"
  onPress={handleAddTransaction}
  variant="primary"
  size="lg"
/>

// Loading button
<EnhancedButton
  title="Saving..."
  loading={isLoading}
  disabled={isLoading}
/>

// Outline button
<EnhancedButton
  title="Cancel"
  variant="outline"
  onPress={handleCancel}
/>
```

### **What it does:**
1. **Press Animation** - Scales down when pressed
2. **Loading State** - Shows spinner when processing
3. **Icon Support** - Can add icons before text
4. **Theme Integration** - Uses app colors automatically
5. **Accessibility** - Proper touch targets and labels

## 📋 **EnhancedCard.js - Card Container Component**

### **Purpose:**
Creates beautiful card containers with shadows, animations, and consistent styling.

### **Key Features:**
```javascript
// Card properties
title = "Card Title"           // Header text
subtitle = "Description"       // Subheader text
icon = "wallet"               // Icon in header
iconColor = "#4CAF50"         // Custom icon color
onPress = {handlePress}       // Makes card clickable

// Visual options
elevation = 'medium'          // Shadow depth: none, low, medium, high
borderRadius = 'lg'           // Corner roundness: sm, md, lg, xl
padding = 'lg'               // Internal spacing: sm, md, lg, xl
gradient = ['#667eea', '#764ba2']  // Gradient background
```

### **Usage Example:**
```javascript
// Simple card with content
<EnhancedCard
  title="Monthly Budget"
  subtitle="Track your spending"
  icon="chart-pie"
  iconColor="#4CAF50"
>
  <Text>Your budget content here</Text>
</EnhancedCard>

// Clickable card
<EnhancedCard
  title="Add Transaction"
  onPress={() => navigation.navigate('AddTransaction')}
  elevation="high"
>
  <Text>Tap to add a new transaction</Text>
</EnhancedCard>
```

### **What it does:**
1. **Consistent Styling** - All cards look the same
2. **Shadow Effects** - Beautiful depth and elevation
3. **Press Animation** - Scales when tapped
4. **Header Support** - Title, subtitle, and icon
5. **Theme Integration** - Matches app colors

## ⌨️ **KeyboardAwareContainer.js - Keyboard Handler**

### **Purpose:**
Automatically adjusts the screen when the keyboard appears, preventing input fields from being hidden.

### **Key Features:**
```javascript
// Automatic keyboard handling
- Detects when keyboard opens/closes
- Scrolls content to keep inputs visible
- Smooth animations during transitions
- Works on both iOS and Android

// Customization options
keyboardOffset = {20}         // Extra space above keyboard
keyboardBehavior = 'padding'  // How to adjust: padding, height
showsVerticalScrollIndicator = {false}  // Hide scroll bar
```

### **Usage Example:**
```javascript
// Wrap your screen content
<KeyboardAwareContainer>
  <View style={styles.form}>
    <TextInput placeholder="Email" />
    <TextInput placeholder="Password" />
    <Button title="Login" />
  </View>
</KeyboardAwareContainer>
```

### **What it does:**
1. **Auto-Scroll** - Keeps input fields visible
2. **Smooth Animation** - No jarring jumps
3. **Cross-Platform** - Works on iOS and Android
4. **Touch Dismiss** - Tap outside to close keyboard

## 💬 **ThemedMessageBox.js - Custom Alert Dialog**

### **Purpose:**
Creates beautiful, themed alert dialogs that match the app's design instead of using basic system alerts.

### **Key Features:**
```javascript
// Message types
type = 'success'    // Green checkmark
type = 'error'      // Red X
type = 'warning'    // Yellow warning
type = 'info'       // Blue info
type = 'confirm'    // Blue question mark

// Customization
title = "Success!"
message = "Transaction added successfully"
buttons = [
  { text: 'Cancel', style: 'cancel' },
  { text: 'OK', onPress: handleOK }
]
autoHide = true           // Auto-close after delay
autoHideDelay = 3000      // 3 seconds
showIcon = true           // Show type icon
animationType = 'fade'    // Animation style
```

### **Usage Example:**
```javascript
// Success message
<ThemedMessageBox
  visible={showSuccess}
  type="success"
  title="Success!"
  message="Transaction added successfully"
  onDismiss={() => setShowSuccess(false)}
  autoHide={true}
/>

// Confirmation dialog
<ThemedMessageBox
  visible={showConfirm}
  type="confirm"
  title="Delete Transaction"
  message="Are you sure you want to delete this transaction?"
  buttons={[
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', onPress: handleDelete, style: 'destructive' }
  ]}
  onDismiss={() => setShowConfirm(false)}
/>
```

### **What it does:**
1. **Beautiful Design** - Matches app theme
2. **Smooth Animations** - Fade in/out effects
3. **Multiple Types** - Success, error, warning, etc.
4. **Custom Buttons** - Flexible button configuration
5. **Auto-Hide** - Can disappear automatically

## 🔧 **MessageBoxProvider.js - Global Message Manager**

### **Purpose:**
Manages message boxes globally so any screen can show messages without managing state.

### **How it works:**
```javascript
// Wrap your app
<MessageBoxProvider>
  <YourApp />
</MessageBoxProvider>

// Use from any screen
import MessageService from '../services/MessageService';

// Show success message
MessageService.showSuccess('Success!', 'Transaction saved');

// Show error message  
MessageService.showError('Error', 'Failed to save transaction');

// Show confirmation
MessageService.showConfirm(
  'Delete Item',
  'Are you sure?',
  () => handleDelete(),  // onConfirm
  () => handleCancel()   // onCancel
);
```

### **What it does:**
1. **Global Access** - Show messages from anywhere
2. **No State Management** - No need to manage visibility
3. **Queue Support** - Multiple messages handled properly
4. **Consistent API** - Same methods across the app

## 🛡️ **UserTypeGuard.js - Access Control Component**

### **Purpose:**
Protects screens so only the right type of user (personal vs company) can access them.

### **Key Features:**
```javascript
// Usage in screens
<UserTypeGuard requiredUserType="personal" navigation={navigation}>
  <YourScreenContent />
</UserTypeGuard>

// What it checks
- Current user's userType from authentication
- Required userType for the screen
- Shows access denied if mismatch
- Provides navigation back to correct dashboard
```

### **Usage Example:**
```javascript
// Protect personal-only screen
export default function PersonalBudgetScreen({ navigation }) {
  return (
    <UserTypeGuard requiredUserType="personal" navigation={navigation}>
      <View>
        <Text>Personal Budget Content</Text>
        {/* Only personal users see this */}
      </View>
    </UserTypeGuard>
  );
}

// Protect company-only screen
export default function CompanyReportsScreen({ navigation }) {
  return (
    <UserTypeGuard requiredUserType="company" navigation={navigation}>
      <View>
        <Text>Company Reports Content</Text>
        {/* Only company users see this */}
      </View>
    </UserTypeGuard>
  );
}
```

### **What it does:**
1. **Access Control** - Blocks wrong user types
2. **Clear Messages** - Explains why access denied
3. **Navigation Help** - Guides to correct screen
4. **Automatic Check** - No manual validation needed

## 🎨 **Component Design Principles**

### **Consistency:**
- All components use the same theme colors
- Similar animations and transitions
- Consistent spacing and typography

### **Reusability:**
- Components work in multiple contexts
- Configurable through props
- No hardcoded values

### **Accessibility:**
- Proper touch targets (minimum 44px)
- Screen reader support
- High contrast colors

### **Performance:**
- Optimized animations using native driver
- Minimal re-renders
- Efficient memory usage

These components make the app look professional and consistent while being easy to maintain and extend.