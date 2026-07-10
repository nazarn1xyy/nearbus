const fs = require('fs');

let content = fs.readFileSync('src/components/Presentation.tsx', 'utf8');

// 1. Remove Card Springs
content = content.replace(/\/\/ MAC FEATURE CARDS[\s\S]*?(?=\/\/ 4\. Map)/, '');
content = content.replace(/\/\/ IPAD FEATURE CARDS[\s\S]*?(?=\/\/ 5\. Bot)/, '');
content = content.replace(/\/\/ BOT FEATURE CARDS[\s\S]*?(?=\/\/ 6\. PWA)/, '');
content = content.replace(/\/\/ PWA FEATURE CARDS[\s\S]*?(?=\/\/ 7\. Outro)/, '');

// 2. Remove floatAnim definition
content = content.replace(/\/\/ Continuous subtle floating[\s\S]*?};\n/, '');

// 3. Remove floatAnim usage
content = content.replace(/<motion\.div animate=\{floatAnim\} className="w-full h-full relative">/g, '<div className="w-full h-full relative">');
content = content.replace(/<\/motion\.div>\n\s*<\/div>\n\s*<\/motion\.div>/g, '</div>\n        </div>\n      </motion.div>'); // fix closing tags
content = content.replace(/<\/motion\.div>\n\s*<\/div>\n\s*<\/div>\n\s*<\/motion\.div>/g, '</div>\n          </div>\n        </div>\n      </motion.div>');

// 4. Remove Glows
content = content.replace(/{\/\* Intense Apple-style glowing orb[\s\S]*?\/>\n\s*/, '');
content = content.replace(/<motion\.div \n\s*animate=\{\{ opacity: \[0\.4, 0\.7[\s\S]*?\/>\n\s*/, '');
content = content.replace(/<motion\.div \n\s*animate=\{\{ opacity: \[0\.5, 0\.8[\s\S]*?\/>\n\s*/, '');
content = content.replace(/<motion\.div \n\s*animate=\{\{ opacity: \[0\.4, 0\.6[\s\S]*?\/>\n\s*/, '');

// 5. Remove JSX for Floating Cards
// Mac cards
content = content.replace(/{\/\* FLOATING FEATURE CARDS \*\/}[\s\S]*?(?=<\/div>\n\s*<\/motion\.div>\n\s*<\/motion\.div>)/, '');
// Map cards
content = content.replace(/{\/\* FLOATING FEATURE CARDS \*\/}[\s\S]*?(?=<\/div>\n\s*<\/div>\n\s*<\/motion\.div>)/, '');
// Bot cards
content = content.replace(/{\/\* FLOATING FEATURE CARDS \*\/}[\s\S]*?(?=<\/div>\n\s*<\/div>\n\s*<\/div>\n\s*<\/motion\.div>)/, '');
// PWA cards
content = content.replace(/{\/\* FLOATING FEATURE CARDS \*\/}[\s\S]*?(?=<\/div>\n\s*<\/div>\n\s*<\/motion\.div>)/, '');

// 6. Fix Typography colors
content = content.replace('className="text-4xl text-[#FF453A] mt-8 font-medium"', 'className="text-4xl text-white mt-8 font-medium"');
content = content.replace('text-[#64D2FF]', 'text-white');

// 7. Fix Background gradient in main container
content = content.replace('className="relative w-full h-screen bg-black overflow-hidden font-sans text-white perspective-[2000px]"', 'className="relative w-full h-screen overflow-hidden font-sans text-white perspective-[2000px]" style={{ backgroundImage: "radial-gradient(circle at 50% 50%, #1c1c1e 0%, #000000 80%)" }}');

fs.writeFileSync('src/components/Presentation.tsx', content);
