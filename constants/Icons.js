import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'react-native';
import Svg, { Path } from 'react-native-svg';

/**
 * App Icons component
 * 
 * Usage:
 * import { AppIcons } from '../constants/Icons';
 * <AppIcons.Dashboard size={24} color="#fff" />
 */

export const Icon = ({ name, size = 24, color = '#000', style, ...props }) => (
    <MaterialCommunityIcons
        name={name}
        size={size}
        color={color}
        style={style}
        {...props}
    />
);

const IconBase = Icon;

/**
 * CUSTOM ICON TEMPLATES
 * 
 * If you have a custom SVG or Image, you can add it here and 
 * then include it in the AppIcons object.
 */

// Example: Custom SVG Icon
const CustomSvgExample = ({ size = 24, color = '#000', ...props }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...props}>
        <Path
            d="M12 2L2 12h3v8h6v-6h2v6h6v-8h3L12 2z"
            fill={color}
        />
    </Svg>
);

// Example: Custom Image Icon (PNG/JPG)
const CustomImageExample = ({ size = 24, style, ...props }) => (
    <Image
        source={require('../assets/adaptive-icon.png')} // Replace with your icon path
        style={[{ width: size, height: size, resizeMode: 'contain' }, style]}
        {...props}
    />
);

export const AppIcons = {
    // Icons from the provided photo
    Clapperboard: (props) => <IconBase name="movie-open" {...props} />, // labeled: Entertainment/Movies
    FastFood: (props) => <IconBase name="hamburger" {...props} />,    // labeled: Food/Dining

    // UI Icons
    Dashboard: (props) => <IconBase name="view-dashboard" {...props} />,
    Transactions: (props) => <IconBase name="swap-horizontal" {...props} />,
    Add: (props) => <IconBase name="plus-circle" {...props} />,
    Profile: (props) => <IconBase name="account-circle" {...props} />,
    Settings: (props) => <IconBase name="cog" {...props} />,
    Back: (props) => <IconBase name="arrow-left" {...props} />,
    Close: (props) => <IconBase name="close" {...props} />,
    ChevronDown: (props) => <IconBase name="chevron-down" {...props} />,
    Check: (props) => <IconBase name="check" {...props} />,
    Eye: (props) => <IconBase name="eye-outline" {...props} />,

    // Finance Icons
    Income: (props) => <IconBase name="arrow-down-circle" {...props} />,
    Expense: (props) => <IconBase name="arrow-up-circle" {...props} />,
    Budget: (props) => <IconBase name="wallet-outline" {...props} />,
    Wallet: (props) => <IconBase name="wallet" {...props} />,
    Cash: (props) => <IconBase name="cash" {...props} />,

    // Category Icons
    Food: (props) => <IconBase name="food" {...props} />,
    Transport: (props) => <IconBase name="car" {...props} />,
    Shopping: (props) => <IconBase name="shopping" {...props} />,
    Movie: (props) => <IconBase name="movie" {...props} />,
    Health: (props) => <IconBase name="medical-bag" {...props} />,
    Education: (props) => <IconBase name="school" {...props} />,
    Bills: (props) => <IconBase name="receipt" {...props} />,
    Business: (props) => <IconBase name="briefcase" {...props} />,
    Freelance: (props) => <IconBase name="laptop" {...props} />,
    Investment: (props) => <IconBase name="trending-up" {...props} />,
    Gift: (props) => <IconBase name="gift" {...props} />,
    Other: (props) => <IconBase name="help-circle" {...props} />,

    // Custom Icons (Examples)
    Logo: (props) => <CustomSvgExample {...props} />,
    AppBrand: (props) => <CustomImageExample {...props} />,
};

export default AppIcons;
