import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Copy,
  Layers, 
  Play, 
  Edit3, 
  Settings, 
  Smile, 
  Type, 
  Image as ImageIcon, 
  MousePointer2, 
  Grid3X3, 
  Monitor, 
  Smartphone, 
  Tablet, 
  Save, 
  Undo, 
  Redo, 
  ChevronRight,
  ChevronDown,
  Box,
  Palette,
  Zap,
  Music,
  HelpCircle,
  X,
  Check,
  Search,
  Eye,
  Download,
  Share2,
  LogIn,
  ArrowLeftRight,
  CheckSquare,
  Hash,
  ListOrdered,
  AlignHorizontalJustifyCenter,
  AlignVerticalJustifyCenter,
  Maximize,
  Bold,
  Italic,
  Underline,
  ALargeSmall,
  Video,
  ChevronUp,
  ChevronsUp,
  ChevronsDown,
  Upload,
  ChevronLeft,
  RefreshCw,
  RotateCw,
  Square,
  Circle,
  RectangleHorizontal,
  Minus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  EditorState, 
  Scene, 
  GameElement, 
  WidgetType, 
  Interaction, 
  Choice 
} from './types';
import { db, auth, signInWithGoogle, serverTimestamp } from './firebase';
import { collection, addDoc, doc, getDocFromServer } from 'firebase/firestore';

// --- Firebase Error Handler ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- Connection Test ---
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();

// Mock Assets
const CHARACTERS = [
  { name: 'Robot Rover', icon: '🤖', id: 'char-1' },
  { name: 'Cosmo Cat', icon: '🐱', id: 'char-2' },
  { name: 'Sparky Puppy', icon: '🐶', id: 'char-3' },
  { name: 'Wise Owl', icon: '🦉', id: 'char-4' },
];

const SHAPE_TEMPLATES = [
  { name: 'Square', icon: Square, id: 'square', width: 100, height: 100, radius: '0.5rem' },
  { name: 'Circle', icon: Circle, id: 'circle', width: 100, height: 100, radius: '9999px' },
  { name: 'Rectangle', icon: RectangleHorizontal, id: 'rect', width: 200, height: 100, radius: '0.5rem' },
  { name: 'Line', icon: Minus, id: 'line', width: 200, height: 4, radius: '0px' },
];

const UI_ELEMENTS: { type: WidgetType; name: string; icon: any }[] = [
  { type: 'text', name: 'Text Label', icon: Type },
  { type: 'button', name: 'Action Button', icon: MousePointer2 },
  { type: 'image', name: 'Decoration', icon: ImageIcon },
  { type: 'video', name: 'Video Content', icon: Video },
  { type: 'quiz', name: 'Matching Pair', icon: Grid3X3 },
  { type: 'multiple-choice', name: 'Interactive Question', icon: Layers },
  { type: 'fill-in-the-blank', name: 'Fill the Blank', icon: Edit3 },
  { type: 'sequencing', name: 'Ordering', icon: ListOrdered },
];

const INITIAL_SCENE: Scene = {
  id: 'scene-1',
  name: 'Intro Scene',
  background: { color: '#f0f9ff' },
  elements: [
    {
      id: 'el-1',
      name: 'Welcome Text',
      type: 'text',
      x: 100,
      y: 100,
      z: 1,
      width: 400,
      height: 60,
      style: {
        fontSize: '32px',
        fontWeight: 'bold',
        color: '#1e293b',
        textAlign: 'center',
      },
      content: 'Welcome to your AI Game!',
      interactions: [],
    },
    {
      id: 'el-2',
      name: 'Hero Character',
      type: 'character',
      x: 250,
      y: 200,
      z: 2,
      width: 120,
      height: 120,
      style: {
        scale: 1,
      },
      content: '🤖',
      interactions: [
        { type: 'click', action: 'animate', payload: { type: 'bounce' } }
      ],
    },
    {
      id: 'el-matching',
      name: 'Match the Colors',
      type: 'quiz',
      x: 100,
      y: 350,
      z: 3,
      width: 600,
      height: 200,
      style: {
        orientation: 'horizontal',
        itemSize: 100,
        itemSpacing: 40,
        layoutMode: 'grid',
        backgroundColor: '#ffffff80',
        borderRadius: '16px',
        padding: '20px'
      },
      pairs: [
        { id: 'p1', leftType: 'text', leftContent: 'Red', rightType: 'icon', rightContent: '🍎' },
        { id: 'p2', leftType: 'text', leftContent: 'Blue', rightType: 'icon', rightContent: '🦋' }
      ],
      interactions: [],
    }
  ],
};

// --- Element Renderers ---
const MatchingPairRenderer = ({ 
  element, 
  isPlaying,
  onComplete
}: { 
  element: GameElement; 
  isPlaying: boolean;
  onComplete?: (score: number, max: number) => void;
}) => {
  const isHorizontal = element.style.orientation === 'horizontal';
  const spacing = element.style.itemSpacing || 20;
  const pairGap = element.style.pairGap || 60;
  const itemWidth = element.style.itemWidth || element.style.itemSize || 100;
  const itemHeight = element.style.itemHeight || element.style.itemSize || 80;

  // Game state
  const [matches, setMatches] = useState<{leftId: string, rightId: string}[]>([]); 
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [selectedRight, setSelectedRight] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleLeftClick = (id: string) => {
    if (!isPlaying) return;
    
    if (selectedLeft === id) {
      setSelectedLeft(null);
    } else {
      setSelectedLeft(id);
      if (selectedRight !== null) {
        // Complete the pair (overwrite if left already matched)
        setMatches(prev => {
          const filtered = prev.filter(m => m.leftId !== id && m.rightId !== selectedRight);
          return [...filtered, { leftId: id, rightId: selectedRight }];
        });
        setSelectedLeft(null);
        setSelectedRight(null);
      }
    }
  };

  const handleRightClick = (id: string) => {
    if (!isPlaying) return;
    
    if (selectedRight === id) {
      setSelectedRight(null);
    } else {
      setSelectedRight(id);
      if (selectedLeft !== null) {
        // Complete the pair (overwrite if right already matched)
        setMatches(prev => {
          const filtered = prev.filter(m => m.rightId !== id && m.leftId !== selectedLeft);
          return [...filtered, { leftId: selectedLeft, rightId: id }];
        });
        setSelectedLeft(null);
        setSelectedRight(null);
      }
    }
  };

  useEffect(() => {
    if (element.pairs && matches.length === element.pairs.length && isPlaying) {
      // Calculate score based on initial ID correspondence
      let correct = 0;
      matches.forEach(m => {
        if (m.leftId === m.rightId) correct++;
      });
      
      // Record Results to Firebase
      const recordResult = async () => {
        const path = 'scores';
        try {
          await addDoc(collection(db, path), {
            projectId: 'current-project-id',
            sceneId: element.id,
            totalPairs: element.pairs?.length || 0,
            correctPairs: correct,
            userId: auth.currentUser?.uid || null,
            playedAt: serverTimestamp()
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, path);
        }
      };

      if (isPlaying) {
        recordResult();
        onComplete?.(correct, element.pairs.length);
      }
    }
  }, [matches, element.pairs, isPlaying, onComplete]);

  const renderContent = (type: string, content: string, src?: string) => {
    if (type === 'image' && src) {
      return (
        <img 
          src={src} 
          alt="" 
          className="w-full h-full object-cover rounded-md pointer-events-none"
          referrerPolicy="no-referrer"
        />
      );
    }
    if (type === 'icon') {
      return <span className="text-2xl">{content}</span>;
    }
    return (
      <div className="flex items-center justify-center p-2 text-center leading-tight">
        <span 
          className="break-words whitespace-pre-wrap text-center"
          style={{
            fontSize: (element.style as any).fontSize || '14px',
            fontWeight: (element.style as any).fontWeight || '700',
            fontFamily: (element.style as any).fontFamily || 'inherit',
            fontStyle: (element.style as any).fontStyle || 'normal',
            fontVariant: (element.style as any).fontVariant || 'normal',
            textDecoration: (element.style as any).textDecoration || 'none',
            textTransform: (element.style as any).textTransform || 'none',
            color: (element.style as any).color || 'inherit'
          }}
        >
          {content}
        </span>
      </div>
    );
  };

  return (
    <div 
      ref={containerRef}
      className="w-full h-full relative"
      style={{ 
        backgroundColor: element.style.backgroundColor,
        borderRadius: element.style.borderRadius,
        padding: element.style.padding
      }}
    >
      {/* SVG Container for Lines */}
      {isPlaying && (
        <svg className="absolute inset-0 pointer-events-none w-full h-full z-0 overflow-visible">
          {matches.map((match, idx) => {
            const leftIndex = element.pairs?.findIndex(p => p.id === match.leftId) ?? -1;
            const rightIndex = element.pairs?.findIndex(p => p.id === match.rightId) ?? -1;
            
            if (leftIndex === -1 || rightIndex === -1) return null;
            
            const total = element.pairs?.length || 1;
            const leftPos = (100 / total) * (leftIndex + 0.5);
            const rightPos = (100 / total) * (rightIndex + 0.5);

            return (
              <motion.line
                key={`${match.leftId}-${match.rightId}-${idx}`}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                x1={`${isHorizontal ? '35%' : leftPos + '%'}`}
                y1={`${isHorizontal ? leftPos + '%' : '35%'}`}
                x2={`${isHorizontal ? '65%' : rightPos + '%'}`}
                y2={`${isHorizontal ? rightPos + '%' : '65%'}`}
                stroke="#FF6B6B"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray="8 4"
              />
            );
          })}
        </svg>
      )}

      <div className={`flex ${isHorizontal ? 'flex-row' : 'flex-col'} items-center justify-center h-full w-full relative z-10`} style={{ gap: pairGap }}>
        {/* Left Column/Row */}
        <div className={`flex ${isHorizontal ? 'flex-col' : 'flex-row'} items-center gap-4`}>
          {element.pairs?.map((pair) => (
            <motion.div 
              key={`${pair.id}-left`}
              onClick={() => handleLeftClick(pair.id)}
              whileTap={{ scale: 0.95 }}
              className={`relative bg-white rounded-xl shadow-sm border-2 flex items-center justify-center p-3 text-center transition-all cursor-pointer ${selectedLeft === pair.id ? 'border-brand-primary ring-4 ring-brand-primary/20 bg-brand-primary/5' : matches.some(m => m.leftId === pair.id) ? 'border-brand-primary bg-brand-primary/5' : 'border-gray-100 hover:border-brand-primary/50'}`}
              style={{ 
                minWidth: itemWidth, 
                minHeight: itemHeight,
                width: element.style.itemWidth ? `${element.style.itemWidth}px` : 'max-content',
                height: element.style.itemHeight ? `${element.style.itemHeight}px` : 'auto',
                padding: element.style.itemPadding !== undefined ? `${element.style.itemPadding}px` : '12px',
                maxWidth: '300px',
                marginBottom: isHorizontal ? spacing : 0,
                marginRight: isHorizontal ? 0 : spacing
              }}
            >
              <div className="flex items-center justify-center">
                {renderContent(pair.leftType, pair.leftContent, pair.leftSrc)}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Right Column/Row */}
        <div className={`flex ${isHorizontal ? 'flex-col' : 'flex-row'} items-center gap-4`}>
          {element.pairs?.map((pair) => (
            <motion.div 
              key={`${pair.id}-right`}
              onClick={() => handleRightClick(pair.id)}
              whileTap={{ scale: 0.95 }}
              className={`relative bg-white rounded-xl shadow-sm border-2 flex items-center justify-center p-3 text-center transition-all cursor-pointer ${selectedRight === pair.id ? 'border-brand-secondary ring-4 ring-brand-secondary/20 bg-brand-secondary/5' : matches.some(m => m.rightId === pair.id) ? 'border-brand-secondary bg-brand-secondary/5' : 'border-gray-100 hover:border-brand-secondary/50'}`}
              style={{ 
                minWidth: itemWidth, 
                minHeight: itemHeight,
                width: element.style.itemWidth ? `${element.style.itemWidth}px` : 'max-content',
                height: element.style.itemHeight ? `${element.style.itemHeight}px` : 'auto',
                padding: element.style.itemPadding !== undefined ? `${element.style.itemPadding}px` : '12px',
                maxWidth: '300px',
                marginBottom: isHorizontal ? spacing : 0,
                marginRight: isHorizontal ? 0 : spacing
              }}
            >
              <div className="flex items-center justify-center">
                {renderContent(pair.rightType, pair.rightContent, pair.rightSrc)}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

// --- Fill In The Blank Renderer ---
const FillInTheBlankRenderer = ({ 
  element, 
  isPlaying, 
  onComplete 
}: { 
  element: GameElement; 
  isPlaying: boolean; 
  onComplete?: (score: number, max: number) => void;
}) => {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isAnswered, setIsAnswered] = useState(false);
  const [feedbacks, setFeedbacks] = useState<Record<string, boolean>>({});

  const content = element.content || '';
  const parts = content.split(/\[blank\]/g);
  const blanks = element.blanks || [];

  const handleCheck = () => {
    if (!isPlaying || isAnswered) return;
    
    let correctCount = 0;
    const newFeedbacks: Record<string, boolean> = {};
    
    blanks.forEach((blank) => {
      const isCorrect = (answers[blank.id] || '').trim().toLowerCase() === (blank.answer || '').trim().toLowerCase();
      if (isCorrect) correctCount++;
      newFeedbacks[blank.id] = isCorrect;
    });

    setFeedbacks(newFeedbacks);
    setIsAnswered(true);

    if (isPlaying) {
      onComplete?.(correctCount, blanks.length);
    }
  };

  return (
    <div 
      className="w-full h-full flex flex-col items-center justify-center p-8 bg-white/80 rounded-2xl backdrop-blur-sm shadow-xl border border-white/50"
      style={{
        backgroundColor: element.style.backgroundColor,
        borderRadius: element.style.borderRadius,
      }}
    >
      <div className="mb-6 w-full text-center">
        {element.src ? (
          <img 
            src={element.src} 
            alt="Question" 
            className="max-h-24 object-contain mx-auto rounded-lg mb-4"
            referrerPolicy="no-referrer"
          />
        ) : null}
      </div>

       <div 
         className="leading-relaxed text-gray-800 text-center flex flex-wrap justify-center items-center gap-y-4"
         style={{
           fontSize: element.style.fontSize || '20px',
           fontWeight: element.style.fontWeight || '500',
           fontFamily: element.style.fontFamily || 'inherit',
           fontStyle: element.style.fontStyle || 'normal',
           fontVariant: element.style.fontVariant || 'normal',
           textDecoration: element.style.textDecoration || 'none',
           textTransform: element.style.textTransform || 'none',
           color: element.style.color || '#1f2937'
         }}
       >
         {parts.map((part, idx) => (
           <React.Fragment key={idx}>
             {part}
             {idx < parts.length - 1 && (
               <input
                 type="text"
                 value={answers[blanks[idx]?.id] || ''}
                 onChange={(e) => setAnswers(prev => ({ ...prev, [blanks[idx].id]: e.target.value }))}
                 disabled={isAnswered}
                 placeholder={blanks[idx]?.placeholder || '...'}
                 style={{ 
                   width: `${Math.max(6, (blanks[idx]?.answer?.length || 0)) * 1.2}em`,
                   fontFamily: element.style.fontFamily || 'inherit',
                   fontSize: 'inherit',
                   fontWeight: 'inherit'
                 }}
                 className={`mx-2 px-3 py-1 border-b-4 outline-none transition-all duration-300 inline-block text-center rounded-t-lg ${
                   isAnswered 
                     ? feedbacks[blanks[idx].id] 
                       ? 'border-green-500 bg-green-50 text-green-700' 
                       : 'border-red-500 bg-red-50 text-red-700'
                     : 'border-brand-primary/30 focus:border-brand-primary focus:bg-white bg-gray-100/50'
                 }`}
               />
             )}
           </React.Fragment>
         ))}
       </div>

       {isPlaying && !isAnswered && (
         <button 
           onClick={handleCheck}
           className="mt-10 px-10 py-4 bg-brand-primary text-white rounded-full font-black text-lg shadow-[0_10px_30px_rgba(255,107,107,0.3)] hover:scale-105 active:scale-95 transition-all uppercase tracking-widest"
         >
           Check Answers
         </button>
       )}
    </div>
  );
};

// --- Sequencing Renderer ---
const SequencingRenderer = ({ 
  element, 
  isPlaying, 
  onComplete,
  onUpdateChoice 
}: { 
  element: GameElement; 
  isPlaying: boolean; 
  onComplete?: (score: number, max: number) => void;
  onUpdateChoice?: (choiceId: string, updates: Partial<Choice>) => void;
}) => {
  const [selectedOrder, setSelectedOrder] = useState<string[]>([]);
  const [manualValues, setManualValues] = useState<Record<string, string>>({});
  const [isAnswered, setIsAnswered] = useState(false);
  const mode = element.style.orderingMode || 'auto';
  const layout = element.style.layoutMode || 'grid';

  const choices = element.choices || [];
  
  // Sort choices by orderIndex for checking if not auto-calculating
  const sortedChoices = [...choices].sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));

  const handleChoiceClick = (id: string) => {
    if (!isPlaying || isAnswered || mode === 'manual') return;
    
    if (selectedOrder.includes(id)) {
      setSelectedOrder(prev => prev.filter(i => i !== id));
    } else {
      setSelectedOrder(prev => [...prev, id]);
    }
  };

  const handleCheck = () => {
    if (!isPlaying || isAnswered) return;
    
    let score = 0;
    if (mode === 'auto') {
      score = selectedOrder.length === choices.length && selectedOrder.every((id, idx) => id === sortedChoices[idx].id) ? 1 : 0;
    } else {
      score = choices.every((c) => {
        const expectedOrder = (c.orderIndex !== undefined ? c.orderIndex : choices.indexOf(c) + 1).toString();
        return manualValues[c.id] === expectedOrder;
      }) ? 1 : 0;
    }

    setIsAnswered(true);
    onComplete?.(score, 1);
  };

  return (
    <div 
      className={`w-full h-full p-6 relative overflow-hidden backdrop-blur-sm ${layout === 'free' ? '' : 'flex flex-col items-center justify-center'}`}
      style={{
        backgroundColor: element.style.backgroundColor,
        borderRadius: element.style.borderRadius,
      }}
    >
      <h3 
        className={`mb-6 whitespace-pre-wrap ${layout === 'free' ? 'absolute top-4 left-4 z-10' : 'text-center'}`}
        style={{
          fontSize: element.style.fontSize || '18px',
          fontWeight: element.style.fontWeight || '700',
          fontFamily: element.style.fontFamily || 'inherit',
          fontStyle: element.style.fontStyle || 'normal',
          fontVariant: element.style.fontVariant || 'normal',
          textDecoration: element.style.textDecoration || 'none',
          textTransform: element.style.textTransform || 'none',
          color: element.style.color || '#1f2937'
        }}
      >
        {element.content}
      </h3>
      
      <div className={layout === 'free' ? 'w-full h-full relative mt-10' : 'flex flex-wrap gap-4 justify-center items-center'}>
        {choices.map((choice, idx) => {
          const itemOrder = selectedOrder.indexOf(choice.id);
          const isCorrect = mode === 'auto' 
            ? itemOrder === sortedChoices.indexOf(choice)
            : manualValues[choice.id] === (choice.orderIndex !== undefined ? choice.orderIndex : choices.indexOf(choice) + 1).toString();

          return (
            <motion.div 
              key={choice.id} 
              drag={!isPlaying && layout === 'free'}
              dragMomentum={false}
              onDragEnd={(_, info) => {
                if (onUpdateChoice) {
                  const snap = 10;
                  const newX = (choice.x || 0) + info.offset.x;
                  const newY = (choice.y || 0) + info.offset.y;
                  onUpdateChoice(choice.id, {
                    x: Math.round(newX / snap) * snap,
                    y: Math.round(newY / snap) * snap
                  });
                }
              }}
              className={`relative flex flex-col items-center gap-2 ${layout === 'free' ? 'absolute cursor-move' : ''}`}
              style={layout === 'free' ? { left: choice.x || 0, top: choice.y || 0 } : {}}
            >
              <motion.div
                onClick={() => handleChoiceClick(choice.id)}
                whileHover={isPlaying && !isAnswered && mode === 'auto' ? { scale: 1.05 } : {}}
                className={`
                  rounded-xl border-2 flex items-center justify-center bg-white shadow-sm transition-all overflow-hidden
                  ${selectedOrder.includes(choice.id) ? 'border-brand-primary ring-2 ring-brand-primary/20' : 'border-gray-100'}
                  ${isAnswered ? (isCorrect ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50') : ''}
                `}
                style={{
                  width: choice.width || element.style.choiceWidth || element.style.itemWidth || (choice.type === 'image' ? 140 : 'auto'),
                  height: choice.height || element.style.choiceHeight || element.style.itemHeight || (choice.type === 'image' ? 140 : 'auto'),
                  maxWidth: layout === 'free' ? '300px' : '200px',
                  minWidth: element.style.choiceWidth || element.style.itemWidth || (choice.type === 'text' ? '120px' : 'none'),
                  minHeight: element.style.choiceHeight || element.style.itemHeight || '48px',
                  padding: element.style.itemPadding !== undefined ? `${element.style.itemPadding}px` : (choice.type === 'text' ? '16px' : '0')
                }}
              >
                {choice.type === 'image' && choice.src ? (
                  <img src={choice.src} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : choice.type === 'icon' ? (
                  <span className="text-3xl">{choice.content}</span>
                ) : (
                  <span 
                    className="text-center leading-tight break-words px-2"
                    style={{
                      fontSize: element.style.fontSize || '14px',
                      fontWeight: element.style.fontWeight || '700',
                      fontFamily: element.style.fontFamily || 'inherit',
                      fontStyle: element.style.fontStyle || 'normal',
                      fontVariant: element.style.fontVariant || 'normal',
                      textDecoration: element.style.textDecoration || 'none',
                      textTransform: element.style.textTransform || 'none',
                      color: element.style.color || 'inherit'
                    }}
                  >
                    {choice.content}
                  </span>
                )}

                {/* Index Overlay for Auto Mode */}
                {mode === 'auto' && selectedOrder.includes(choice.id) && (
                  <div className="absolute -top-2 -right-2 w-7 h-7 bg-brand-primary text-white rounded-full flex items-center justify-center font-black text-[10px] border-2 border-white shadow-lg z-20">
                    {itemOrder + 1}
                  </div>
                )}
              </motion.div>

              {/* Input Box for Manual Mode */}
              {mode === 'manual' && (
                <input
                  type="text"
                  maxLength={2}
                  disabled={isAnswered}
                  value={manualValues[choice.id] || ''}
                  onChange={(e) => setManualValues(prev => ({ ...prev, [choice.id]: e.target.value }))}
                  placeholder="#"
                  className={`w-10 h-10 text-center border-2 rounded-xl font-black focus:border-brand-primary outline-none transition-all shadow-sm ${isAnswered ? (isCorrect ? 'border-green-500 bg-green-50 text-green-600' : 'border-red-500 bg-red-50 text-red-600') : 'border-gray-100 bg-white'}`}
                />
              )}
            </motion.div>
          );
        })}
      </div>

      {isPlaying && !isAnswered && (
        <button 
          onClick={handleCheck}
          className={`${layout === 'free' ? 'absolute bottom-4 right-4' : 'mt-8'} px-8 py-3 bg-brand-primary text-white rounded-full font-black shadow-xl hover:scale-105 active:scale-95 transition-all text-sm uppercase tracking-widest`}
        >
          Check Sequence
        </button>
      )}
    </div>
  );
};

// --- Checkbox Renderer ---
const CheckboxRenderer = ({ element, isPlaying }: { element: GameElement, isPlaying: boolean }) => {
  const [checkedStates, setCheckedStates] = useState<Record<string, boolean>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const choices = element.choices || [];
  
  const toggleChecked = (id: string) => {
    if (!isPlaying || isSubmitted) return;
    setCheckedStates(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCheck = () => {
    setIsSubmitted(true);
  };

  const isAllCorrect = choices.every(c => {
    const isChecked = !!checkedStates[c.id];
    return isChecked === !!c.isCorrect;
  });

  return (
    <div 
      className="w-full h-full flex flex-col p-6 overflow-y-auto relative"
      style={{
        backgroundColor: element.style.backgroundColor,
        borderRadius: element.style.borderRadius,
      }}
    >
      {element.content && (
        <h3 
          className="mb-6 tracking-tight leading-tight whitespace-pre-wrap"
          style={{
            fontSize: element.style.fontSize || '18px',
            fontWeight: element.style.fontWeight || '900',
            fontFamily: element.style.fontFamily || 'inherit',
            fontStyle: element.style.fontStyle || 'normal',
            fontVariant: element.style.fontVariant || 'normal',
            textDecoration: element.style.textDecoration || 'none',
            textTransform: element.style.textTransform || 'none',
            color: element.style.color || '#1f2937'
          }}
        >
          {element.content}
        </h3>
      )}
      
      <div 
        className="space-y-3 flex-1"
        style={{ gap: `${element.style.itemSpacing || 12}px`, display: 'flex', flexDirection: 'column' }}
      >
        {choices.length > 0 ? (
          choices.map((choice) => {
            const isChecked = !!checkedStates[choice.id];
            const showFeedback = isSubmitted;
            const isChoiceCorrect = isChecked === !!choice.isCorrect;

            return (
              <div 
                key={choice.id} 
                className={`flex items-center gap-4 rounded-xl border-2 transition-all group ${
                  showFeedback 
                    ? (isChoiceCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200')
                    : 'bg-white/50 border-white/20 hover:bg-white'
                }`}
                style={{ 
                  padding: element.style.itemPadding !== undefined ? `${element.style.itemPadding}px` : '12px',
                  width: element.style.itemWidth ? `${element.style.itemWidth}px` : 'auto',
                  height: element.style.itemHeight ? `${element.style.itemHeight}px` : 'auto',
                  marginBottom: 0 
                }}
              >
                <button 
                  disabled={!isPlaying || isSubmitted}
                  onClick={() => toggleChecked(choice.id)}
                  className={`shrink-0 w-8 h-8 rounded-lg border-2 transition-all flex items-center justify-center ${
                    isChecked 
                      ? 'bg-brand-primary border-brand-primary text-white shadow-lg scale-110' 
                      : 'bg-white border-gray-200 group-hover:border-brand-primary/50'
                  }`}
                >
                  {isChecked && <Check size={20} strokeWidth={4} />}
                </button>
                <div className="flex items-center gap-3 flex-1">
                   {choice.type === 'image' && choice.src && (
                     <img src={choice.src} alt="" className="h-12 w-12 object-contain rounded-lg" referrerPolicy="no-referrer" />
                   )}
                   {choice.type === 'icon' && (
                     <span className="text-2xl">{choice.content}</span>
                   )}
                   <span 
                     className="tracking-tight"
                     style={{
                       fontSize: element.style.fontSize || '14px',
                       fontWeight: element.style.fontWeight || '700',
                       fontFamily: element.style.fontFamily || 'inherit',
                       fontStyle: element.style.fontStyle || 'normal',
                       fontVariant: element.style.fontVariant || 'normal',
                       textDecoration: element.style.textDecoration || 'none',
                       textTransform: element.style.textTransform || 'none',
                       color: element.style.color || '#374151'
                     }}
                   >
                     {choice.type === 'text' ? choice.content : (choice.content || 'Select Item')}
                   </span>
                </div>
                {showFeedback && (
                  <div className="ml-auto">
                    {isChoiceCorrect ? (
                      <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center animate-bounce-short">
                        <Check size={14} strokeWidth={4} />
                      </div>
                    ) : (
                      <div className="w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center animate-shake">
                        <X size={14} strokeWidth={4} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="flex items-center justify-center h-20 text-gray-400 italic text-sm">
            No items added yet.
          </div>
        )}
      </div>

      {isPlaying && choices.length > 0 && !isSubmitted && (
        <button 
          onClick={handleCheck}
          className="mt-6 w-full py-3 bg-brand-primary text-white font-black uppercase tracking-widest rounded-xl shadow-[0_4px_0_0_#904ed9] active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-2"
        >
          <Play size={18} fill="currentColor" />
          Check Selection
        </button>
      )}

      {isSubmitted && (
        <div className={`mt-6 p-4 rounded-xl flex items-center justify-center gap-3 animate-in fade-in zoom-in duration-300 ${isAllCorrect ? 'bg-green-100 text-green-700 border-2 border-green-200' : 'bg-red-100 text-red-700 border-2 border-red-200'}`}>
          {isAllCorrect ? (
            <>
              <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center">
                <Check size={18} strokeWidth={4} />
              </div>
              <span className="font-black tracking-tight">Great Job! Everything is correct!</span>
            </>
          ) : (
            <>
              <div className="w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center">
                <X size={18} strokeWidth={4} />
              </div>
              <span className="font-black tracking-tight">Oops! Check your answers again.</span>
              <button 
                onClick={() => setIsSubmitted(false)}
                className="ml-auto px-4 py-1.5 bg-white/50 hover:bg-white rounded-lg text-[10px] font-black tracking-widest transition-colors"
              >
                Try Again
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// --- NumberBox Renderer ---
const NumberBoxRenderer = ({ element, isPlaying }: { element: GameElement, isPlaying: boolean }) => {
  const [values, setValues] = useState<Record<string, string>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const choices = element.choices || [];

  const handleCheck = () => {
    setIsSubmitted(true);
  };

  const isAllCorrect = choices.every(c => {
    if (!c.answer) return true; // If no answer specified, it's whatever
    return values[c.id] === c.answer;
  });

  return (
    <div 
      className="w-full h-full flex flex-col p-6 overflow-y-auto relative"
      style={{
        backgroundColor: element.style.backgroundColor,
        borderRadius: element.style.borderRadius,
      }}
    >
      {element.content && (
        <h3 
          className="mb-6 tracking-tight leading-tight whitespace-pre-wrap"
          style={{
            fontSize: element.style.fontSize || '18px',
            fontWeight: element.style.fontWeight || '900',
            fontFamily: element.style.fontFamily || 'inherit',
            fontStyle: element.style.fontStyle || 'normal',
            fontVariant: element.style.fontVariant || 'normal',
            textDecoration: element.style.textDecoration || 'none',
            textTransform: element.style.textTransform || 'none',
            color: element.style.color || '#1f2937'
          }}
        >
          {element.content}
        </h3>
      )}

      <div 
        className="space-y-4 flex-1"
        style={{ gap: `${element.style.itemSpacing || 16}px`, display: 'flex', flexDirection: 'column' }}
      >
        {choices.length > 0 ? (
          choices.map((choice) => {
            const val = values[choice.id] || '';
            const showFeedback = isSubmitted && choice.answer;
            const isCorrect = val.toLowerCase().trim() === (choice.answer || '').toLowerCase().trim();

            return (
              <div 
                key={choice.id} 
                className={`flex flex-col gap-2 rounded-2xl border-2 transition-all ${
                  showFeedback 
                    ? (isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200')
                    : 'bg-white/30 border-white/20'
                }`}
                style={{ 
                  padding: element.style.itemPadding !== undefined ? `${element.style.itemPadding}px` : '16px',
                  width: element.style.itemWidth ? `${element.style.itemWidth}px` : 'auto',
                  height: element.style.itemHeight ? `${element.style.itemHeight}px` : 'auto',
                  marginBottom: 0 
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {choice.type === 'image' && choice.src && (
                      <img src={choice.src} alt="" className="h-10 w-10 object-contain rounded-lg" referrerPolicy="no-referrer" />
                    )}
                    {choice.type === 'icon' && (
                      <span className="text-xl">{choice.content}</span>
                    )}
                    <span 
                      className="tracking-widest leading-none"
                      style={{
                        fontSize: element.style.fontSize || '10px',
                        fontWeight: element.style.fontWeight || '900',
                        fontFamily: element.style.fontFamily || 'inherit',
                        fontStyle: element.style.fontStyle || 'normal',
                        fontVariant: element.style.fontVariant || 'normal',
                        textDecoration: element.style.textDecoration || 'none',
                        textTransform: element.style.textTransform || 'none',
                        color: element.style.color || '#6b7280'
                      }}
                    >
                      {choice.type === 'text' ? choice.content : (choice.content || 'Enter Value')}
                    </span>
                  </div>
                  {showFeedback && (
                    <div>
                      {isCorrect ? (
                        <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center animate-bounce-short">
                          <Check size={14} strokeWidth={4} />
                        </div>
                      ) : (
                        <div className="w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center animate-shake">
                          <X size={14} strokeWidth={4} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <input 
                  type="text"
                  disabled={!isPlaying || isSubmitted}
                  value={val}
                  onChange={(e) => setValues(prev => ({ ...prev, [choice.id]: e.target.value }))}
                  className={`w-full px-4 py-3 bg-white border-2 rounded-xl focus:ring-4 focus:ring-brand-primary/10 outline-none transition-all font-mono text-lg font-black ${
                    showFeedback
                      ? (isCorrect ? 'border-green-300' : 'border-red-300')
                      : 'border-gray-100 focus:border-brand-primary'
                  }`}
                  placeholder="..."
                />
              </div>
            );
          })
        ) : (
          <div className="text-gray-400 italic text-xs text-center py-10">
            No input fields added yet.
          </div>
        )}
      </div>

      {isPlaying && choices.length > 0 && !isSubmitted && (
        <button 
          onClick={handleCheck}
          className="mt-6 w-full py-3 bg-brand-primary text-white font-black uppercase tracking-widest rounded-xl shadow-[0_4px_0_0_#904ed9] active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-2"
        >
          <Play size={18} fill="currentColor" />
          Verify Answers
        </button>
      )}

      {isSubmitted && (
        <div className={`mt-6 p-4 rounded-xl flex items-center justify-center gap-3 animate-in fade-in zoom-in duration-300 ${isAllCorrect ? 'bg-green-100 text-green-700 border-2 border-green-200' : 'bg-red-100 text-red-700 border-2 border-red-200'}`}>
          {isAllCorrect ? (
            <>
              <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center">
                <Check size={18} strokeWidth={4} />
              </div>
              <span className="font-black tracking-tight">Correct! You got them all right!</span>
            </>
          ) : (
            <>
              <div className="w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center">
                <X size={18} strokeWidth={4} />
              </div>
              <span className="font-black tracking-tight">Some answers are wrong. Try again!</span>
              <button 
                onClick={() => setIsSubmitted(false)}
                className="ml-auto px-4 py-1.5 bg-white/50 hover:bg-white rounded-lg text-[10px] font-black tracking-widest transition-colors"
              >
                Retry
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// --- Multiple Choice Renderer ---
const MultipleChoiceRenderer = ({ 
  element, 
  isPlaying,
  onComplete,
  onUpdateChoice
}: { 
  element: GameElement; 
  isPlaying: boolean;
  onComplete?: (score: number, max: number) => void;
  onUpdateChoice?: (choiceId: string, updates: Partial<Choice>) => void;
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const layout = element.style.choiceLayout || 'vertical';
  const spacing = element.style.itemSpacing || 12;

  const handleChoiceClick = (choiceId: string, isCorrect: boolean) => {
    if (!isPlaying || isAnswered) return;
    
    setSelectedId(choiceId);
    setIsAnswered(true);

    // Record results
    const recordResult = async () => {
      const path = 'scores';
      try {
        await addDoc(collection(db, path), {
          projectId: 'current-project-id',
          sceneId: element.id,
          type: 'multiple-choice',
          isCorrect: isCorrect,
          selectedChoiceId: choiceId,
          userId: auth.currentUser?.uid || null,
          playedAt: serverTimestamp()
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, path);
      }
    };

    if (isPlaying) {
      recordResult();
      onComplete?.(isCorrect ? 1 : 0, 1);
    }
  };

  const renderChoiceContent = (choice: Choice) => {
    const align = element.style.choiceAlign || 'center';
    
    if (choice.type === 'image' && choice.src) {
      return (
        <img 
          src={choice.src} 
          alt="" 
          className="max-w-full max-h-full object-contain rounded-lg pointer-events-none"
          referrerPolicy="no-referrer"
        />
      );
    }
    if (choice.type === 'icon') {
      return <span className="text-3xl">{choice.content}</span>;
    }
    return (
      <span 
        className={`tracking-tight w-full ${align === 'left' ? 'text-left' : align === 'right' ? 'text-right' : 'text-center'}`}
        style={{
          fontSize: (element.style as any).fontSize || '14px',
          fontWeight: (element.style as any).fontWeight || '700',
          fontFamily: (element.style as any).fontFamily || 'inherit',
          fontStyle: (element.style as any).fontStyle || 'normal',
          fontVariant: (element.style as any).fontVariant || 'normal',
          textDecoration: (element.style as any).textDecoration || 'none',
          textTransform: (element.style as any).textTransform || 'none',
          color: (element.style as any).color || 'inherit'
        }}
      >
        {choice.content}
      </span>
    );
  };

  return (
    <div 
      className="w-full h-full flex flex-col items-center justify-center p-6 relative"
      style={{ 
        backgroundColor: element.style.backgroundColor,
        borderRadius: element.style.borderRadius,
      }}
    >
      {/* Question / Prompt Area */}
      <div className={`mb-8 w-full text-center ${layout === 'free' ? 'absolute top-6 left-0 right-0' : ''}`}>
        {element.src ? (
          <img 
            src={element.src} 
            alt="Question" 
            className="max-h-32 object-contain mx-auto rounded-lg mb-4"
            referrerPolicy="no-referrer"
          />
        ) : null}
        <h3 
          className="leading-tight whitespace-pre-wrap"
          style={{
            fontSize: element.style.fontSize || '20px',
            fontWeight: element.style.fontWeight || '700',
            fontFamily: element.style.fontFamily || 'inherit',
            fontStyle: element.style.fontStyle || 'normal',
            fontVariant: element.style.fontVariant || 'normal',
            textDecoration: element.style.textDecoration || 'none',
            textTransform: element.style.textTransform || 'none',
            color: element.style.color || '#1f2937'
          }}
        >
          {element.content}
        </h3>
      </div>

      {/* Choices Grid */}
      <div 
        className={`${layout === 'free' ? 'w-full h-full relative' : `flex ${layout === 'horizontal' ? 'flex-row' : 'flex-col'} flex-wrap items-center justify-center`}`}
        style={{ gap: spacing }}
      >
        {element.choices?.map((choice) => (
          <motion.button
            key={choice.id}
            drag={!isPlaying && layout === 'free'}
            dragMomentum={false}
            onDragEnd={(_, info) => {
              if (onUpdateChoice) {
                const snap = 10;
                const newX = (choice.x || 0) + info.offset.x;
                const newY = (choice.y || 0) + info.offset.y;
                onUpdateChoice(choice.id, {
                  x: Math.round(newX / snap) * snap,
                  y: Math.round(newY / snap) * snap
                });
              }
            }}
            onClick={() => handleChoiceClick(choice.id, choice.isCorrect)}
            whileHover={!isAnswered ? { scale: 1.02 } : {}}
            whileTap={!isAnswered ? { scale: 0.98 } : {}}
            style={layout === 'free' ? {
              position: 'absolute',
              left: choice.x || 0,
              top: choice.y || 0,
              width: element.style.choiceWidth || element.style.itemWidth || (choice.type === 'image' ? 140 : 'auto'),
              height: element.style.choiceHeight || element.style.itemHeight || (choice.type === 'image' ? 140 : 'auto'),
              padding: element.style.itemPadding !== undefined ? `${element.style.itemPadding}px` : undefined,
            } : {
              width: element.style.choiceWidth || element.style.itemWidth || (choice.type === 'image' ? 140 : 'auto'),
              height: element.style.choiceHeight || element.style.itemHeight || (choice.type === 'image' ? 140 : 'auto'),
              padding: element.style.itemPadding !== undefined ? `${element.style.itemPadding}px` : undefined,
            }}
            className={`
              relative rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-2
              ${!element.style.itemWidth && choice.type === 'text' ? 'min-w-[140px]' : ''}
              ${element.style.itemPadding === undefined ? 'px-6 py-4' : ''}
              ${layout === 'free' && !isPlaying ? 'cursor-move' : ''}
              ${!isAnswered 
                ? 'bg-white border-gray-100 hover:border-brand-primary hover:shadow-lg shadow-sm' 
                : selectedId === choice.id 
                  ? choice.isCorrect 
                    ? 'bg-green-50 border-green-500 shadow-green-100' 
                    : 'bg-red-50 border-red-500 shadow-red-100'
                  : choice.isCorrect 
                    ? 'bg-green-50/50 border-green-200 opacity-80' 
                    : 'bg-white border-gray-50 opacity-40'
              }
            `}
          >
            {isAnswered && (
              <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full flex items-center justify-center shadow-md animate-in zoom-in-50 duration-300">
                {choice.isCorrect ? (
                  <div className="bg-green-500 text-white p-1 rounded-full"><Check size={16} strokeWidth={4} /></div>
                ) : selectedId === choice.id ? (
                  <div className="bg-red-500 text-white p-1 rounded-full"><X size={16} strokeWidth={4} /></div>
                ) : null}
              </div>
            )}
            
            <div className={`flex items-center w-full h-12 ${element.style.choiceAlign === 'left' ? 'justify-start' : element.style.choiceAlign === 'right' ? 'justify-end' : 'justify-center'}`}>
              {renderChoiceContent(choice)}
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
};

// --- Smart Transform Tool ---
const TransformTool = ({ 
  element, 
  onTransform,
  onDelete,
  onDuplicate,
  onMoveLayer
}: { 
  element: GameElement; 
  onTransform: (updates: Partial<GameElement>) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onMoveLayer: (id: string, action: 'front' | 'back' | 'forward' | 'backward') => void;
}) => {
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const [isRotating, setIsRotating] = useState(false);

  const handleResizeStart = (e: React.MouseEvent, type: string) => {
    e.stopPropagation();
    setIsResizing(type);
    
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = element.width;
    const startHeight = element.height;
    const startXPos = element.x;
    const startYPos = element.y;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      let newWidth = startWidth;
      let newHeight = startHeight;
      let newX = startXPos;
      let newY = startYPos;

      if (type.includes('e')) newWidth = Math.max(50, startWidth + deltaX);
      if (type.includes('s')) newHeight = Math.max(50, startHeight + deltaY);
      if (type.includes('w')) {
        const potentialWidth = Math.max(50, startWidth - deltaX);
        if (potentialWidth !== startWidth) {
          newWidth = potentialWidth;
          newX = startXPos + (startWidth - newWidth);
        }
      }
      if (type.includes('n')) {
        const potentialHeight = Math.max(50, startHeight - deltaY);
        if (potentialHeight !== startHeight) {
          newHeight = potentialHeight;
          newY = startYPos + (startHeight - newHeight);
        }
      }

      onTransform({ width: newWidth, height: newHeight, x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsResizing(null);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleRotateStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsRotating(true);

    const centerX = element.x + element.width / 2;
    const centerY = element.y + element.height / 2;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - centerX;
      const dy = moveEvent.clientY - centerY;
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);
      onTransform({ style: { ...element.style, rotation: angle + 90 } });
    };

    const handleMouseUp = () => {
      setIsRotating(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <>
      {/* Highlight Border */}
      <div className="absolute pointer-events-none border-2 border-brand-primary" 
        style={{ 
          top: -4, left: -4, 
          width: element.width + 8, 
          height: element.height + 8,
          borderRadius: element.style.borderRadius
        }} 
      />
      
      {/* Main Control Toolbar (Floating Top) */}
      <div 
        className="absolute bottom-[calc(100%+16px)] left-1/2 -translate-x-1/2 z-50 pointer-events-auto flex items-center bg-white shadow-2xl border border-gray-100 rounded-2xl p-1.5 gap-1.5 ring-4 ring-black/5"
      >
        {/* Layer Controls */}
        <div className="flex items-center gap-1 pr-2 border-r border-gray-100">
          <button 
            onClick={(e) => { e.stopPropagation(); onMoveLayer(element.id, 'back'); }}
            className="p-2 text-gray-400 hover:text-brand-primary hover:bg-gray-50 rounded-xl transition-all"
            title="Send to Back"
          >
            <ChevronsDown size={16} />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onMoveLayer(element.id, 'backward'); }}
            className="p-2 text-gray-400 hover:text-brand-primary hover:bg-gray-50 rounded-xl transition-all"
            title="Move Backward"
          >
            <ChevronDown size={16} />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onMoveLayer(element.id, 'forward'); }}
            className="p-2 text-gray-400 hover:text-brand-primary hover:bg-gray-50 rounded-xl transition-all"
            title="Move Forward"
          >
            <ChevronUp size={16} />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onMoveLayer(element.id, 'front'); }}
            className="p-2 text-gray-400 hover:text-brand-primary hover:bg-gray-50 rounded-xl transition-all"
            title="Bring to Front"
          >
            <ChevronsUp size={16} />
          </button>
        </div>

        {/* Action Tools */}
        <button
          onClick={(e) => { e.stopPropagation(); onDuplicate(element.id); }}
          className="p-2 bg-blue-50 text-blue-500 hover:bg-blue-500 hover:text-white rounded-xl transition-all shadow-sm"
          title="Duplicate"
        >
          <Copy size={16} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(element.id); }}
          className="p-2 bg-red-50 text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition-all shadow-sm"
          title="Delete"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* Resize Handles */}
      {['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map((pos) => (
        <div
          key={pos}
          onMouseDown={(e) => handleResizeStart(e, pos)}
          className={`absolute w-4 h-4 bg-white border-2 border-brand-primary rounded-full z-30 pointer-events-auto shadow-md hover:scale-125 transition-transform cursor-${pos === 'n' || pos === 's' ? 'ns' : pos === 'e' || pos === 'w' ? 'ew' : pos === 'nw' || pos === 'se' ? 'nwse' : 'nesw'}-resize`}
          style={{
            top: pos.includes('n') ? -8 : pos.includes('s') ? 'calc(100% - 8px)' : 'calc(50% - 8px)',
            left: pos.includes('w') ? -8 : pos.includes('e') ? 'calc(100% - 8px)' : 'calc(50% - 8px)',
          }}
        />
      ))}

      {/* Rotation Handle (Bottom Bar) */}
      <div 
        onMouseDown={handleRotateStart}
        className="absolute top-[calc(100%+16px)] left-1/2 -translate-x-1/2 w-10 h-10 bg-white border-2 border-brand-primary rounded-full z-30 flex items-center justify-center cursor-pointer pointer-events-auto hover:bg-brand-primary transition-all shadow-xl group hover:scale-110 active:scale-95"
      >
        <RotateCw size={18} className="text-brand-primary group-hover:text-white" />
      </div>
    </>
  );
};

const FAMOUS_FONTS = [
  'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Playfair Display', 
  'Merriweather', 'Space Grotesk', 'Comic Sans MS', 'Arial', 'Times New Roman', 'Courier New'
];

export default function App() {
  const [state, setState] = useState<EditorState>({
    scenes: [INITIAL_SCENE],
    currentSceneId: 'scene-1',
    selectedElementId: null,
    editingElementId: null,
    zoom: 1,
    viewMode: 'desktop',
    isPlaying: false,
  });

  const [history, setHistory] = useState<EditorState[]>([]);
  const [redoStack, setRedoStack] = useState<EditorState[]>([]);
  const [gameTime, setGameTime] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [totalScores, setTotalScores] = useState<{sceneId: string, score: number, max: number}[]>([]);
  const [uploadTargetId, setUploadTargetId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Timer logic
  useEffect(() => {
    let interval: any;
    if (state.isPlaying && !showResults) {
      interval = setInterval(() => {
        setGameTime(prev => prev + 1);
      }, 1000);
    } else if (!state.isPlaying) {
      setGameTime(0);
    }
    return () => clearInterval(interval);
  }, [state.isPlaying, showResults]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Wrap state updates with history tracking
  const pushToHistory = useCallback((newState: EditorState) => {
    setHistory(prev => [...prev, state].slice(-50)); // Keep last 50 steps
    setRedoStack([]); // Clear redo stack on new action
    setState(newState);
  }, [state]);

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setRedoStack(r => [state, ...r]);
    setHistory(h => h.slice(0, -1));
    setState(prev);
  }, [history, state]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[0];
    setHistory(h => [...h, state]);
    setRedoStack(r => r.slice(1));
    setState(next);
  }, [redoStack, state]);

  // Keyboard support for Deletion and Undo/Redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedElementId) {
        handleDeleteElement(state.selectedElementId);
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.selectedElementId, handleUndo, handleRedo]);

  const [activeTab, setActiveTab] = useState<'elements' | 'scenes' | 'layers'>('elements');
  const [searchTerm, setSearchTerm] = useState('');

  const currentScene = state.scenes.find(s => s.id === state.currentSceneId) || state.scenes[0];
  const selectedElement = currentScene.elements.find(e => e.id === state.selectedElementId);

  // --- Handlers ---
  const handleAddElement = (type: WidgetType, icon?: string) => {
    const newElement: GameElement = {
      id: `el-${Date.now()}`,
      name: `New ${type}`,
      type,
      x: 100,
      y: 100,
      z: currentScene.elements.length + 1,
      width: type === 'character' ? 80 : 200,
      height: type === 'character' ? 80 : 60,
      style: {
        fontSize: '16px',
        color: '#000',
        backgroundColor: type === 'button' ? '#FF6B6B' : 'transparent',
        borderRadius: '8px',
        rotation: 0,
      },
      content: type === 'character' ? (icon || '❓') : (type === 'text' ? 'New Text' : 'Click Me'),
      interactions: [],
    };

    if (type === 'quiz') {
      newElement.width = 600;
      newElement.height = 300;
      newElement.style = {
        orientation: 'horizontal',
        itemWidth: 120,
        itemHeight: 80,
        itemSpacing: 20,
        layoutMode: 'grid',
        backgroundColor: '#ffffff80',
        borderRadius: '16px',
        padding: '20px',
        rotation: 0,
      };
      newElement.pairs = [
        { id: `p-${Date.now()}`, leftType: 'text', leftContent: 'Question', rightType: 'text', rightContent: 'Answer' }
      ];
    } else if (type === 'multiple-choice') {
      newElement.width = 500;
      newElement.height = 400;
      newElement.content = 'Select the correct answer:';
      newElement.style = {
        ...newElement.style,
        backgroundColor: '#ffffff',
        borderRadius: '24px',
        choiceLayout: 'vertical',
        itemSpacing: 12,
      };
      newElement.choices = [
        { id: `c-${Date.now()}-1`, type: 'text', content: 'Correct Answer', isCorrect: true },
        { id: `c-${Date.now()}-2`, type: 'text', content: 'Wrong Answer', isCorrect: false },
      ];
    } else if (type === 'fill-in-the-blank') {
      newElement.width = 600;
      newElement.height = 300;
      newElement.content = 'We are learning [blank] (fill in the blank).';
      newElement.style = {
        ...newElement.style,
        backgroundColor: '#ffffff',
        borderRadius: '24px',
        padding: '20px',
      };
      newElement.blanks = [
        { id: `b-${Date.now()}`, answer: 'everything', placeholder: 'Type here...' }
      ];
    } else if (type === 'sequencing') {
      newElement.width = 600;
      newElement.height = 350;
      newElement.content = 'Put these in order:';
      newElement.style = {
        ...newElement.style,
        backgroundColor: '#ffffff',
        borderRadius: '24px',
        orderingMode: 'auto',
      };
      newElement.choices = [
        { id: `c-${Date.now()}-1`, type: 'icon', content: '🥚', isCorrect: true },
        { id: `c-${Date.now()}-2`, type: 'icon', content: '🐣', isCorrect: true },
        { id: `c-${Date.now()}-3`, type: 'icon', content: '🐥', isCorrect: true },
      ];
    } else if (type === 'checkbox') {
      newElement.width = 150;
      newElement.height = 40;
      newElement.content = 'Checkbox Label';
    } else if (type === 'image') {
      newElement.width = 200;
      newElement.height = 200;
      newElement.src = 'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=400&h=400&fit=crop';
      newElement.style = {
        ...newElement.style,
        objectFit: 'cover',
        borderRadius: '12px',
      };
    } else if (type === 'video') {
      newElement.width = 400;
      newElement.height = 225;
      newElement.src = ''; // User will provide URL
      newElement.style = {
        ...newElement.style,
        backgroundColor: '#000000',
        borderRadius: '12px',
      };
    } else if (type === 'numberbox') {
      newElement.width = 100;
      newElement.height = 60;
      newElement.content = 'Count';
    } else if (type === 'shape') {
      const template = SHAPE_TEMPLATES.find(t => t.id === icon) || SHAPE_TEMPLATES[0];
      newElement.width = template.width;
      newElement.height = template.height;
      newElement.name = template.name;
      newElement.style = {
        ...newElement.style,
        backgroundColor: '#cbd5e1',
        borderRadius: template.radius,
      };
      newElement.content = '';
    }

    pushToHistory({
      ...state,
      scenes: state.scenes.map(s => s.id === state.currentSceneId 
        ? { ...s, elements: [...s.elements, newElement] } 
        : s),
      selectedElementId: newElement.id,
    });
  };

  const updateElement = (id: string, updates: Partial<GameElement>) => {
    pushToHistory({
      ...state,
      scenes: state.scenes.map(s => s.id === state.currentSceneId 
        ? { ...s, elements: s.elements.map(e => e.id === id ? { ...e, ...updates } : e) } 
        : s)
    });
  };

  const handleUpdateChoice = (elementId: string, choiceId: string, updates: Partial<Choice>) => {
    const el = currentScene.elements.find(e => e.id === elementId);
    if (!el || !el.choices) return;
    
    const newChoices = el.choices.map(c => 
      c.id === choiceId ? { ...c, ...updates } : c
    );
    
    updateElement(elementId, { choices: newChoices });
  };

  const handleCenterElement = (id: string, axis: 'x' | 'y' | 'both') => {
    const el = currentScene.elements.find(e => e.id === id);
    if (!el) return;
    
    const containerWidth = 1024; // Base canvas width
    const containerHeight = 576; // Base canvas height
    
    const updates: Partial<GameElement> = {};
    if (axis === 'x' || axis === 'both') updates.x = (containerWidth - el.width) / 2;
    if (axis === 'y' || axis === 'both') updates.y = (containerHeight - el.height) / 2;
    
    updateElement(id, updates);
  };

  const updateStyle = (id: string, updates: Partial<GameElement['style']>) => {
    const el = currentScene.elements.find(e => e.id === id);
    if (el) {
      updateElement(id, { style: { ...el.style, ...updates } });
    }
  };

  const handleDuplicateElement = (id: string) => {
    const el = currentScene.elements.find(e => e.id === id);
    if (!el) return;
    
    const newElement: GameElement = {
      ...JSON.parse(JSON.stringify(el)),
      id: `el-${Date.now()}`,
      name: `${el.name} (Copy)`,
      x: el.x + 20,
      y: el.y + 20,
    };

    pushToHistory({
      ...state,
      selectedElementId: newElement.id,
      scenes: state.scenes.map(s => s.id === state.currentSceneId 
        ? { ...s, elements: [...s.elements, newElement] } 
        : s)
    });
  };

  const moveElementLayer = (id: string, action: 'front' | 'back' | 'forward' | 'backward') => {
    const scene = state.scenes.find(s => s.id === state.currentSceneId);
    if (!scene) return;
    
    let elements = [...scene.elements].sort((a, b) => a.z - b.z);
    const index = elements.findIndex(e => e.id === id);
    if (index === -1) return;

    const el = elements[index];
    
    if (action === 'front') {
      elements.splice(index, 1);
      elements.push(el);
    } else if (action === 'back') {
      elements.splice(index, 1);
      elements.unshift(el);
    } else if (action === 'forward') {
      if (index === elements.length - 1) return;
      elements[index] = elements[index + 1];
      elements[index + 1] = el;
    } else if (action === 'backward') {
      if (index === 0) return;
      elements[index] = elements[index - 1];
      elements[index - 1] = el;
    }

    const updatedElements = elements.map((e, idx) => ({ ...e, z: idx + 1 }));
    
    pushToHistory({
      ...state,
      scenes: state.scenes.map(s => s.id === state.currentSceneId ? { ...s, elements: updatedElements } : s)
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && uploadTargetId) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const src = event.target?.result as string;
        updateElement(uploadTargetId, { src });
        setUploadTargetId(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDuplicateChoice = (elementId: string, choiceId: string) => {
    const el = currentScene.elements.find(e => e.id === elementId);
    if (!el || !el.choices) return;
    
    const choice = el.choices.find(c => c.id === choiceId);
    if (!choice) return;

    const newChoice = {
      ...JSON.parse(JSON.stringify(choice)),
      id: `c-copy-${Date.now()}`
    };

    const choiceIndex = el.choices.findIndex(c => c.id === choiceId);
    const newChoices = [...el.choices];
    newChoices.splice(choiceIndex + 1, 0, newChoice);

    updateElement(elementId, { choices: newChoices });
  };

  const handleDeleteElement = (id: string) => {
    pushToHistory({
      ...state,
      selectedElementId: state.selectedElementId === id ? null : state.selectedElementId,
      scenes: state.scenes.map(s => s.id === state.currentSceneId 
        ? { ...s, elements: s.elements.filter(e => e.id !== id) } 
        : s)
    });
  };

  // Expose for TransformTool
  useEffect(() => {
    (window as any).handleDeleteElement = handleDeleteElement;
    (window as any).handleDuplicateElement = handleDuplicateElement;
    return () => {
      delete (window as any).handleDeleteElement;
      delete (window as any).handleDuplicateElement;
    };
  }, [handleDeleteElement, handleDuplicateElement]);

  const handleAddScene = () => {
    const newScene: Scene = {
      id: `scene-${Date.now()}`,
      name: `Scene ${state.scenes.length + 1}`,
      background: { color: '#ffffff' },
      elements: [],
    };
    pushToHistory({
      ...state,
      scenes: [...state.scenes, newScene],
      currentSceneId: newScene.id,
    });
  };

  const handleNextScene = useCallback(() => {
    const currentIndex = state.scenes.findIndex(s => s.id === state.currentSceneId);
    if (currentIndex < state.scenes.length - 1) {
      setState(p => ({ ...p, currentSceneId: state.scenes[currentIndex + 1].id }));
    }
  }, [state.scenes, state.currentSceneId]);

  const handlePrevScene = useCallback(() => {
    const currentIndex = state.scenes.findIndex(s => s.id === state.currentSceneId);
    if (currentIndex > 0) {
      setState(p => ({ ...p, currentSceneId: state.scenes[currentIndex - 1].id }));
    }
  }, [state.scenes, state.currentSceneId]);

  const handleSceneComplete = (score: number, max: number) => {
    const currentScene = state.scenes.find(s => s.id === state.currentSceneId);
    if (currentScene?.isFinalPage) return; // Don't score final page

    setTotalScores(prev => {
      const filtered = prev.filter(s => s.sceneId !== state.currentSceneId);
      return [...filtered, { sceneId: state.currentSceneId, score, max }];
    });
    
    // Auto proceed to next scene or end game
    setTimeout(() => {
      const currentIndex = state.scenes.findIndex(s => s.id === state.currentSceneId);
      const nextScene = state.scenes[currentIndex + 1];
      
      if (nextScene) {
        setState(p => ({ ...p, currentSceneId: nextScene.id }));
      } else {
        setShowResults(true);
      }
    }, 1000);
  };

  const resetGame = () => {
    setTotalScores([]);
    setShowResults(false);
    setState(p => ({ ...p, currentSceneId: state.scenes[0].id, isPlaying: true }));
  };
  const [user, setUser] = useState(auth.currentUser);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      const u = await signInWithGoogle();
      setUser(u);
    } catch (error) {
      console.error("Login failed", error);
    }
  };
  const currentSceneIndex = state.scenes.findIndex(s => s.id === state.currentSceneId);

  return (
    <div className={`flex flex-col h-screen overflow-hidden text-gray-800 ${state.isPlaying ? 'bg-black' : 'bg-gray-100'}`}>
      {/* Top Navigation - Only in Editor */}
      {!state.isPlaying && (
        <nav className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 z-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-brand-primary rounded-lg flex items-center justify-center text-white font-bold shadow-soft">K</div>
            <div className="flex flex-col">
              <span className="text-sm font-bold leading-tight">KiddieCreator</span>
              <span className="text-[10px] text-gray-400 font-medium">V1.4 PRO EDITOR</span>
            </div>
            <div className="ml-4 flex items-center gap-1 bg-gray-100 rounded-full p-1">
              <button 
                onClick={() => setState(p => ({ ...p, isPlaying: false }))}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${!state.isPlaying ? 'bg-white shadow-sm text-brand-primary' : 'text-gray-500'}`}
              >
                <Edit3 size={14} /> Design
              </button>
              <button 
                onClick={() => setState(p => ({ ...p, isPlaying: true }))}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${state.isPlaying ? 'bg-white shadow-sm text-green-500' : 'text-gray-500'}`}
              >
                <Play size={14} /> Play
              </button>
            </div>
            
            {user ? (
              <div className="ml-2 flex items-center gap-2 bg-gray-100 rounded-full px-3 py-1">
                <div className="w-5 h-5 bg-brand-secondary rounded-full flex items-center justify-center text-[10px] text-white font-bold">
                  {user.displayName?.[0] || 'U'}
                </div>
                <span className="text-[10px] font-bold text-gray-500 truncate max-w-[100px]">{user.displayName}</span>
              </div>
            ) : (
              <button 
                onClick={handleLogin}
                className="ml-2 flex items-center gap-1.5 px-3 py-1 bg-brand-secondary text-white rounded-full text-xs font-bold hover:bg-opacity-90 transition-all"
              >
                <LogIn size={14} /> Login
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-gray-100 rounded-lg p-1 mr-4">
              <button 
                onClick={() => setState(p => ({ ...p, viewMode: 'desktop' }))}
                className={`p-1.5 rounded-md transition-all ${state.viewMode === 'desktop' ? 'bg-white shadow-sm text-brand-primary' : 'text-gray-400'}`}
              >
                <Monitor size={16} />
              </button>
              <button 
                onClick={() => setState(p => ({ ...p, viewMode: 'tablet' }))}
                className={`p-1.5 rounded-md transition-all ${state.viewMode === 'tablet' ? 'bg-white shadow-sm text-brand-primary' : 'text-gray-400'}`}
              >
                <Tablet size={16} />
              </button>
              <button 
                onClick={() => setState(p => ({ ...p, viewMode: 'mobile' }))}
                className={`p-1.5 rounded-md transition-all ${state.viewMode === 'mobile' ? 'bg-white shadow-sm text-brand-primary' : 'text-gray-400'}`}
              >
                <Smartphone size={16} />
              </button>
            </div>
            <button 
              onClick={handleUndo}
              disabled={history.length === 0}
              className={`p-2 hover:bg-gray-100 rounded-lg transition-colors ${history.length === 0 ? 'opacity-30' : 'text-gray-500'}`}
            >
              <Undo size={18} />
            </button>
            <button 
              onClick={handleRedo}
              disabled={redoStack.length === 0}
              className={`p-2 hover:bg-gray-100 rounded-lg transition-colors ${redoStack.length === 0 ? 'opacity-30' : 'text-gray-500'}`}
            >
              <Redo size={18} />
            </button>
            <div className="h-6 w-px bg-gray-200 mx-2" />
            <button className="flex items-center gap-2 px-4 py-1.5 bg-brand-primary hover:bg-opacity-90 text-white rounded-lg text-sm font-bold shadow-md transition-all transform active:scale-95">
              <Save size={16} /> Save Project
            </button>
          </div>
        </nav>
      )}

      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Sidebar - Only in Editor */}
        {!state.isPlaying && (
          <aside className="w-72 bg-white border-r border-gray-200 flex flex-col z-40">
            <div className="flex p-2 border-b border-gray-100">
              {(['elements', 'scenes', 'layers'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-1.5 text-xs font-bold capitalize transition-all border-b-2 ${activeTab === tab ? 'border-brand-primary text-brand-primary' : 'border-transparent text-gray-400'}`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              {activeTab === 'elements' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <Zap size={12} className="text-brand-primary" /> Core Components
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      {UI_ELEMENTS.map(el => (
                        <button
                          key={el.type}
                          onClick={() => handleAddElement(el.type)}
                          className="flex flex-col items-center justify-center p-3 rounded-xl border border-gray-100 hover:border-brand-primary hover:bg-red-50 group transition-all"
                        >
                          <el.icon size={20} className="text-gray-400 group-hover:text-brand-primary mb-1.5" />
                          <span className="text-[10px] font-bold text-gray-500 group-hover:text-brand-primary">{el.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <Smile size={12} className="text-brand-secondary" /> Characters
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      {CHARACTERS.map(char => (
                        <button
                          key={char.id}
                          onClick={() => handleAddElement('character', char.icon)}
                          className="flex flex-col items-center justify-center p-3 rounded-xl border border-gray-100 hover:border-brand-secondary hover:bg-teal-50 group transition-all"
                        >
                          <span className="text-2xl mb-1 group-hover:scale-110 transition-transform">{char.icon}</span>
                          <span className="text-[10px] font-bold text-gray-500 group-hover:text-brand-secondary text-center">{char.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <Palette size={12} className="text-blue-500" /> Shapes & Lines
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      {SHAPE_TEMPLATES.map(shape => (
                        <button
                          key={shape.id}
                          onClick={() => handleAddElement('shape', shape.id)}
                          className="flex flex-col items-center justify-center p-3 rounded-xl border border-gray-100 hover:border-blue-500 hover:bg-blue-50 group transition-all"
                        >
                          <shape.icon size={20} className="text-gray-400 group-hover:text-blue-500 mb-1.5" />
                          <span className="text-[10px] font-bold text-gray-500 group-hover:text-blue-500">{shape.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'scenes' && (
                <div className="space-y-3">
                  {state.scenes.map((scene, idx) => (
                    <div key={scene.id} className="relative group">
                      <button
                        onClick={() => setState(p => ({ ...p, currentSceneId: scene.id }))}
                        className={`w-full text-left p-4 rounded-xl border-2 flex items-center gap-4 transition-all ${state.currentSceneId === scene.id ? 'border-brand-primary bg-red-50' : 'border-gray-100 hover:border-gray-200 bg-white'}`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${state.currentSceneId === scene.id ? 'bg-brand-primary text-white' : 'bg-gray-100 text-gray-400'}`}>
                          {idx + 1}
                        </div>
                        <div className="flex flex-col">
                          <span className={`text-[10px] font-black uppercase tracking-widest ${state.currentSceneId === scene.id ? 'text-brand-primary/60' : 'text-gray-300'}`}>Page</span>
                          <span className={`text-xs font-bold leading-none ${state.currentSceneId === scene.id ? 'text-brand-primary' : 'text-gray-600'}`}>{scene.name}</span>
                        </div>
                      </button>
                      
                      {state.scenes.length > 1 && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            const newScenes = state.scenes.filter(s => s.id !== scene.id);
                            pushToHistory({
                              ...state,
                              scenes: newScenes,
                              currentSceneId: state.currentSceneId === scene.id ? newScenes[0].id : state.currentSceneId
                            });
                          }}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-white border border-gray-100 text-gray-400 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 hover:text-red-500 shadow-md transition-all scale-75 group-hover:scale-100"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button 
                    onClick={handleAddScene}
                    className="w-full mt-2 flex items-center justify-center gap-2 p-4 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 hover:border-brand-primary hover:text-brand-primary hover:bg-red-50/50 transition-all font-black text-[10px] uppercase tracking-widest"
                  >
                    <Plus size={16} /> Add Page
                  </button>
                </div>
              )}

              {activeTab === 'layers' && (
                <div className="space-y-1">
                  {[...currentScene.elements].sort((a, b) => b.z - a.z).map(el => (
                    <div
                      key={el.id}
                      onClick={() => setState(p => ({ ...p, selectedElementId: el.id }))}
                      className={`p-2.5 rounded-lg flex items-center justify-between cursor-pointer group transition-all ${state.selectedElementId === el.id ? 'bg-brand-primary text-white' : 'hover:bg-gray-50'}`}
                    >
                      <div className="flex items-center gap-3">
                        <Layers size={14} className={state.selectedElementId === el.id ? 'text-white/80' : 'text-gray-400'} />
                        <span className="text-xs font-medium">{el.name}</span>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Eye size={12} className={state.selectedElementId === el.id ? 'text-white/80' : 'text-gray-400'} />
                        <Trash2 
                          size={12} 
                          className={state.selectedElementId === el.id ? 'text-white hover:text-red-200' : 'text-gray-400 hover:text-red-500'} 
                          onClick={(e) => { e.stopPropagation(); handleDeleteElement(el.id); }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        )}

        {/* Center Canvas */}
        <main className={`flex-1 relative flex items-center justify-center transition-colors duration-500 ${state.isPlaying ? 'bg-[#0f172a]' : 'bg-gray-200'}`}>
          {/* Results Screen Overlay */}
          {showResults && (
            <div className="absolute inset-0 z-[100] bg-brand-primary/95 flex items-center justify-center p-6 text-white backdrop-blur-lg">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                className="max-w-md w-full bg-white rounded-[2.5rem] p-10 text-center text-gray-800 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)]"
              >
                <div className="w-24 h-24 bg-yellow-400 rounded-full flex items-center justify-center text-white text-5xl mx-auto mb-8 shadow-lg ring-8 ring-yellow-400/20">🏆</div>
                <h2 className="text-4xl font-black mb-2 italic tracking-tight uppercase">Test Submitted!</h2>
                <p className="text-gray-400 font-bold mb-10 uppercase tracking-[0.2em] text-[10px]">Your Learning Journey Continues</p>
                
                <div className="flex flex-col gap-4">
                  <button 
                    onClick={resetGame}
                    className="w-full py-5 bg-brand-primary text-white rounded-[1.25rem] font-black text-lg shadow-xl shadow-brand-primary/30 hover:scale-[1.02] active:scale-95 transition-all outline-none"
                  >
                    Play Again
                  </button>
                  <button 
                    onClick={() => { setShowResults(false); setState(p => ({ ...p, isPlaying: false })); }}
                    className="w-full py-3 text-gray-400 font-bold hover:text-gray-600 transition-colors uppercase text-[10px] tracking-widest"
                  >
                    Return to Design
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {/* Results Screen Toggle (Hidden) */}

          {/* Play Mode HUD */}
          <AnimatePresence>
            {state.isPlaying && (
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="absolute top-8 left-1/2 -translate-x-1/2 flex items-center gap-4 z-50 w-full max-w-2xl px-6"
              >
                <div className="bg-white/90 backdrop-blur-xl border border-white/20 rounded-2xl px-6 py-3 flex items-center justify-between shadow-2xl shadow-black/50 w-full">
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={handlePrevScene}
                      disabled={currentSceneIndex === 0}
                      className={`p-2.5 rounded-xl transition-all ${currentSceneIndex === 0 ? 'text-gray-200 cursor-not-allowed' : 'bg-gray-100 hover:bg-gray-200 text-gray-500'}`}
                      title="Previous Page"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] whitespace-nowrap">Interactive Content</span>
                      <span className="text-sm font-black text-brand-dark">Test Page {currentSceneIndex + 1} <span className="text-gray-300 font-bold mx-1">/</span> {state.scenes.length}</span>
                    </div>

                    <button 
                      onClick={handleNextScene}
                      disabled={currentSceneIndex === state.scenes.length - 1}
                      className={`p-2.5 rounded-xl transition-all ${currentSceneIndex === state.scenes.length - 1 ? 'text-gray-200 cursor-not-allowed' : 'bg-gray-100 hover:bg-gray-200 text-gray-500'}`}
                      title="Next Page"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="w-px h-8 bg-gray-200" />
                    <div className="flex flex-col items-center min-w-[70px]">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Clock</span>
                      <span className="text-lg font-mono font-bold text-brand-primary">{formatTime(gameTime)}</span>
                    </div>
                    <div className="w-px h-8 bg-gray-200 mx-2" />
                    <button 
                      onClick={() => {
                        const currentId = state.currentSceneId;
                        setState(p => ({ ...p, isPlaying: false }));
                        setTimeout(() => setState(p => ({ ...p, isPlaying: true, currentSceneId: currentId })), 50);
                      }}
                      className="p-2.5 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-xl transition-all"
                      title="Restart Scene"
                    >
                      <RefreshCw size={18} />
                    </button>
                    
                    {currentSceneIndex === state.scenes.length - 1 && (
                      <button 
                        onClick={() => setShowResults(true)}
                        className="ml-2 px-6 py-2.5 bg-brand-secondary text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg"
                      >
                        Submit Test
                      </button>
                    )}
                  </div>
                </div>

                <button 
                  onClick={() => setState(p => ({ ...p, isPlaying: false }))}
                  className="bg-white/90 hover:bg-red-50 backdrop-blur-md border border-white/20 rounded-2xl p-4 text-gray-500 hover:text-red-500 transition-all group overflow-hidden relative shadow-2xl shadow-black/50 shrink-0"
                >
                  <X size={20} className="relative z-10" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Canvas Wrapper */}
          <motion.div 
            layout
            className={`relative transition-all duration-500 bg-white overflow-hidden shadow-2xl ${state.isPlaying ? 'z-10 rounded-[3rem] border-[12px] border-white ring-1 ring-black/5 shadow-black/50' : 'z-0 border border-gray-300 rounded-lg'}`}
            style={{
              width: state.viewMode === 'desktop' ? 'min(1024px, 95vw)' : state.viewMode === 'tablet' ? 'min(768px, 90vw)' : 'min(375px, 85vw)',
              height: state.viewMode === 'desktop' ? 'min(576px, 80vh)' : state.viewMode === 'tablet' ? 'min(1024px, 85vh)' : 'min(667px, 80vh)',
              backgroundColor: currentScene.background.color,
              backgroundImage: currentScene.background.image ? `url(${currentScene.background.image})` : 'none',
              backgroundSize: 'cover',
              transform: `scale(${state.zoom * (state.isPlaying && state.viewMode === 'mobile' ? 0.8 : 1)})`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Elements */}
            {currentScene.elements.map(el => (
              <motion.div
                key={el.id}
                drag={!state.isPlaying}
                dragMomentum={false}
                onDragEnd={(_, info) => {
                  const snap = 10;
                  const newX = el.x + info.offset.x / state.zoom;
                  const newY = el.y + info.offset.y / state.zoom;
                  updateElement(el.id, { 
                    x: Math.round(newX / snap) * snap,
                    y: Math.round(newY / snap) * snap 
                  });
                }}
                onMouseDown={() => !state.isPlaying && setState(p => ({ ...p, selectedElementId: el.id }))}
                onDoubleClick={() => {
                  if (!state.isPlaying && (el.type === 'text' || el.type === 'button' || el.type === 'character')) {
                    setState(p => ({ ...p, editingElementId: el.id }));
                  }
                }}
                className={`absolute ${!state.isPlaying ? 'cursor-move' : 'cursor-default'} select-none`}
                style={{
                  left: el.x,
                  top: el.y,
                  width: el.width,
                  height: el.height,
                  zIndex: el.z,
                  transform: `rotate(${el.style.rotation || 0}deg)`,
                  borderColor: el.style.borderColor,
                  borderWidth: el.style.borderWidth,
                  borderStyle: el.style.borderStyle || 'none',
                  borderRadius: el.style.borderRadius,
                  boxShadow: el.style.boxShadow,
                  overflow: (el.type === 'image' || el.type === 'video') ? 'hidden' : 'visible',
                }}
              >
                {/* Visual Content */}
                {state.editingElementId === el.id ? (
                  <textarea
                    autoFocus
                    className="w-full h-full p-2 bg-white/90 border-2 border-brand-primary rounded-lg focus:outline-none resize-none font-inherit text-inherit z-50"
                    value={el.content || ''}
                    onChange={(e) => updateElement(el.id, { content: e.target.value })}
                    onBlur={() => setState(p => ({ ...p, editingElementId: null }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                        setState(p => ({ ...p, editingElementId: null }));
                      }
                    }}
                    style={{
                      fontSize: el.style.fontSize,
                      fontWeight: el.style.fontWeight,
                      fontFamily: el.style.fontFamily,
                      textAlign: (el.style.textAlign || 'center') as any,
                      color: el.style.color,
                    }}
                  />
                ) : el.type === 'quiz' ? (
                  <MatchingPairRenderer 
                    element={el} 
                    isPlaying={state.isPlaying} 
                    onComplete={handleSceneComplete}
                  />
                ) : el.type === 'multiple-choice' ? (
                  <MultipleChoiceRenderer 
                    element={el} 
                    isPlaying={state.isPlaying} 
                    onComplete={handleSceneComplete}
                    onUpdateChoice={(choiceId, updates) => handleUpdateChoice(el.id, choiceId, updates)}
                  />
                ) : el.type === 'fill-in-the-blank' ? (
                  <FillInTheBlankRenderer 
                    element={el} 
                    isPlaying={state.isPlaying} 
                    onComplete={handleSceneComplete}
                  />
                ) : el.type === 'sequencing' ? (
                  <SequencingRenderer 
                    element={el} 
                    isPlaying={state.isPlaying} 
                    onComplete={handleSceneComplete}
                    onUpdateChoice={(choiceId, updates) => handleUpdateChoice(el.id, choiceId, updates)}
                  />
                ) : el.type === 'checkbox' ? (
                  <CheckboxRenderer 
                    element={el} 
                    isPlaying={state.isPlaying} 
                  />
                ) : el.type === 'numberbox' ? (
                  <NumberBoxRenderer 
                    element={el} 
                    isPlaying={state.isPlaying} 
                  />
                ) : el.type === 'image' ? (
                  <div 
                    className="w-full h-full relative group cursor-pointer"
                    onClick={() => {
                      if (!state.isPlaying) {
                        setUploadTargetId(el.id);
                        fileInputRef.current?.click();
                      }
                    }}
                  >
                    <img 
                      src={el.src} 
                      alt="" 
                      className="w-full h-full pointer-events-none select-none"
                      style={{ 
                        objectFit: el.style.objectFit || 'contain',
                      }}
                      referrerPolicy="no-referrer"
                    />
                    {!state.isPlaying && (
                      <div className="absolute inset-0 bg-brand-primary/0 group-hover:bg-brand-primary/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <Upload size={24} className="text-white drop-shadow-lg" />
                      </div>
                    )}
                  </div>
                ) : el.type === 'video' ? (
                  <div 
                    className="w-full h-full relative group cursor-pointer bg-black flex items-center justify-center overflow-hidden"
                    onClick={() => {
                      if (!state.isPlaying) {
                        const url = window.prompt('Enter Video URL (YouTube or Vimeo):', el.src || '');
                        if (url !== null) updateElement(el.id, { src: url });
                      }
                    }}
                  >
                    {el.src ? (
                      <iframe
                        src={
                          el.src.includes('youtube.com') 
                            ? el.src.replace('watch?v=', 'embed/').split('&')[0]
                            : el.src.includes('youtu.be')
                            ? `https://www.youtube.com/embed/${el.src.split('/').pop()}`
                            : el.src.includes('vimeo.com')
                            ? `https://player.vimeo.com/video/${el.src.split('/').pop()}`
                            : el.src
                        }
                        className="w-full h-full pointer-events-none"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-gray-500">
                        <Video size={32} />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Click to set URL</span>
                      </div>
                    )}
                    {!state.isPlaying && (
                      <div className="absolute inset-0 bg-brand-primary/0 group-hover:bg-brand-primary/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <Video size={24} className="text-white drop-shadow-lg" />
                      </div>
                    )}
                  </div>
                ) : el.type === 'button' ? (
                  <button 
                    className={`w-full h-full rounded-xl font-bold flex items-center justify-center p-4 transition-all shadow-md active:scale-95 ${state.isPlaying ? 'hover:scale-105 hover:brightness-110' : 'cursor-move'}`}
                    style={{
                      fontSize: el.style.fontSize,
                      fontWeight: el.style.fontWeight,
                      fontFamily: el.style.fontFamily,
                      color: el.style.color || '#ffffff',
                      backgroundColor: el.style.backgroundColor || '#fb7185',
                      borderRadius: el.style.borderRadius,
                      textAlign: (el.style.textAlign || 'center') as any,
                    }}
                    onClick={() => {
                      if (state.isPlaying) {
                        const submitAction = el.interactions?.find(i => i.action === 'submit-test');
                        const nextSceneAction = el.interactions?.find(i => i.action === 'next-scene');
                        
                        if (submitAction) {
                          setShowResults(true);
                        } else if (nextSceneAction) {
                          handleNextScene();
                        } else if (currentSceneIndex === state.scenes.length - 1) {
                          setShowResults(true);
                        } else {
                          handleNextScene();
                        }
                      }
                    }}
                  >
                    <span className="whitespace-pre-wrap select-none truncate">{el.content || 'Button'}</span>
                  </button>
                ) : el.type === 'character' ? (
                  <div 
                    className="w-full h-full flex items-center justify-center p-2 pointer-events-none"
                    style={{
                      fontSize: el.style.fontSize,
                      fontWeight: el.style.fontWeight,
                      fontFamily: el.style.fontFamily,
                      color: el.style.color,
                      textAlign: (el.style.textAlign || 'center') as any,
                    }}
                  >
                    <span className="text-6xl select-none">{el.content}</span>
                  </div>
                ) : el.type === 'shape' ? (
                  <div 
                    className="w-full h-full"
                    style={{
                      backgroundColor: el.style.backgroundColor || '#cbd5e1',
                      borderRadius: el.style.borderRadius,
                      borderWidth: el.style.borderWidth,
                      borderColor: el.style.borderColor,
                      borderStyle: el.style.borderStyle as any || 'solid',
                    }}
                  />
                ) : (
                  <div 
                    className="w-full h-full flex items-center justify-center p-2 pointer-events-none"
                    style={{
                      fontSize: el.style.fontSize,
                      fontWeight: el.style.fontWeight,
                      fontFamily: el.style.fontFamily,
                      fontStyle: el.style.fontStyle,
                      fontVariant: el.style.fontVariant,
                      textDecoration: el.style.textDecoration,
                      textTransform: el.style.textTransform,
                      color: el.style.color,
                      backgroundColor: el.style.backgroundColor,
                      borderRadius: el.style.borderRadius,
                      textAlign: (el.style.textAlign || 'center') as any,
                      lineHeight: 1.2
                    }}
                  >
                    <span className="whitespace-pre-wrap select-none">{el.content}</span>
                  </div>
                )}

                {/* Transform Tool */}
                {!state.isPlaying && state.selectedElementId === el.id && (
                  <TransformTool 
                    element={el} 
                    onTransform={(updates) => updateElement(el.id, updates)} 
                    onDelete={handleDeleteElement}
                    onDuplicate={handleDuplicateElement}
                    onMoveLayer={moveElementLayer}
                  />
                )}
              </motion.div>
            ))}
          </motion.div>

          {/* Bottom Scene Navigator Bar (Canva Style) */}
          {!state.isPlaying && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 h-20 bg-white shadow-[0_20px_50px_rgba(0,0,0,0.1)] rounded-[2rem] border border-gray-100 flex items-center px-6 gap-6 z-40 max-w-[90vw] min-w-[400px]">
              <div className="flex-1 flex gap-4 overflow-x-auto py-2 px-1 custom-scrollbar no-scrollbar scroll-smooth">
                {state.scenes.map((scene, idx) => (
                  <div key={scene.id} className="relative group shrink-0">
                    <div className="absolute -top-5 left-0 text-[10px] font-black text-gray-300 uppercase tracking-widest">{idx + 1}</div>
                    <button 
                      onClick={() => setState(p => ({ ...p, currentSceneId: scene.id, selectedElementId: null }))}
                      className={`h-12 w-24 rounded-xl border-2 transition-all flex flex-col items-center justify-center shadow-sm relative ${state.currentSceneId === scene.id ? 'border-brand-primary ring-4 ring-brand-primary/10 bg-brand-primary/5' : 'border-gray-100 hover:border-gray-300 bg-white group-hover:bg-gray-50'}`}
                    >
                      <span className={`text-[9px] font-bold truncate w-full px-2 text-center transition-colors ${state.currentSceneId === scene.id ? 'text-brand-primary' : 'text-gray-400'}`}>{scene.name}</span>
                    </button>
                    {state.scenes.length > 1 && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          const newScenes = state.scenes.filter(s => s.id !== scene.id);
                          pushToHistory({
                            ...state,
                            scenes: newScenes,
                            currentSceneId: state.currentSceneId === scene.id ? newScenes[0].id : state.currentSceneId
                          });
                        }}
                        className="absolute -top-1 -right-1 w-5 h-5 bg-white border border-gray-100 text-gray-400 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 shadow-md hover:text-red-500 transition-all scale-75 group-hover:scale-100"
                      >
                        <X size={10} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              
              <button 
                onClick={handleAddScene}
                className="shrink-0 h-10 w-10 bg-brand-primary text-white rounded-full shadow-lg hover:rotate-90 hover:scale-110 active:scale-95 transition-all flex items-center justify-center z-50 ml-2"
                title="Add New Page"
              >
                <Plus size={24} strokeWidth={3} />
              </button>

              <div className="h-10 w-px bg-gray-100 mx-2" />
              
              <div className="flex items-center gap-3">
                <div className="flex bg-gray-100 rounded-xl p-1 items-center">
                  <button onClick={() => setState(p => ({...p, zoom: Math.max(0.3, p.zoom - 0.1)}))} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-brand-primary font-bold transition-colors">−</button>
                  <span className="px-1 flex items-center justify-center text-[10px] font-black text-gray-500 min-w-[45px] select-none">{Math.round(state.zoom * 100)}%</span>
                  <button onClick={() => setState(p => ({...p, zoom: Math.min(2.5, p.zoom + 0.1)}))} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-brand-primary font-bold transition-colors">+</button>
                </div>
              </div>
            </div>
          )}

          {/* Zoom Controls - Hidden in Play Mode */}
          {!state.isPlaying && (
            <div className="absolute bottom-6 right-6 flex items-center bg-white rounded-full shadow-lg border border-gray-100 p-1">
              <button onClick={() => setState(p => ({ ...p, zoom: Math.max(0.2, p.zoom - 0.1) }))} className="w-8 h-8 rounded-full hover:bg-gray-50 flex items-center justify-center">-</button>
              <span className="text-[10px] font-bold w-12 text-center text-gray-400">{Math.round(state.zoom * 100)}%</span>
              <button onClick={() => setState(p => ({ ...p, zoom: Math.min(2, p.zoom + 0.1) }))} className="w-8 h-8 rounded-full hover:bg-gray-50 flex items-center justify-center">+</button>
            </div>
          )}
        </main>

        {/* Right Sidebar - Only in Editor */}
        {!state.isPlaying && (
          <aside className="w-80 bg-white border-l border-gray-200 flex flex-col z-40 overflow-y-auto custom-scrollbar">
          {!selectedElement ? (
            <div className="flex-1 flex flex-col p-5">
              <header className="flex items-center justify-between mb-8 pb-4 border-b border-gray-100">
                <div className="flex flex-col">
                  <h2 className="text-xs font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                    <Grid3X3 size={14} className="text-brand-primary" /> Page Settings
                  </h2>
                  <span className="text-[9px] text-gray-400 font-bold uppercase tracking-tight">Configuring current page canvas</span>
                </div>
              </header>

              <div className="space-y-8">
                {/* Page Identification */}
                <section>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-3">General Info</label>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <span className="text-[10px] text-gray-500 font-bold block">Page Name</span>
                      <input 
                        type="text"
                        value={currentScene.name}
                        onChange={(e) => {
                          const name = e.target.value;
                          pushToHistory({
                            ...state,
                            scenes: state.scenes.map(s => s.id === state.currentSceneId ? { ...s, name } : s)
                          });
                        }}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                        placeholder="Scene Name..."
                      />
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-brand-primary/[0.03] border border-brand-primary/10 rounded-xl">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-brand-primary uppercase tracking-tight">Final Page</span>
                        <span className="text-[9px] text-gray-400 font-medium whitespace-pre-wrap">Treat as completion screen</span>
                      </div>
                      <button 
                        onClick={() => {
                          pushToHistory({
                            ...state,
                            scenes: state.scenes.map(s => s.id === state.currentSceneId ? { ...s, isFinalPage: !s.isFinalPage } : s)
                          });
                        }}
                        className={`w-10 h-5 rounded-full transition-all relative ${currentScene.isFinalPage ? 'bg-brand-primary' : 'bg-gray-200'}`}
                      >
                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${currentScene.isFinalPage ? 'left-6' : 'left-1'}`} />
                      </button>
                    </div>
                  </div>
                </section>

                {/* Background Styling */}
                <section>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-3">Atmosphere</label>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center px-1">
                        <span className="text-[10px] text-gray-500 font-bold block">Background Color</span>
                        <span className="text-[9px] font-mono text-gray-400">{currentScene.background.color}</span>
                      </div>
                      <input 
                        type="color"
                        value={currentScene.background.color}
                        onChange={(e) => {
                          const color = e.target.value;
                          pushToHistory({
                            ...state,
                            scenes: state.scenes.map(s => s.id === state.currentSceneId ? { ...s, background: { ...s.background, color } } : s)
                          });
                        }}
                        className="w-full h-10 bg-gray-50 border border-gray-200 rounded-xl px-1 py-1 cursor-pointer"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-[10px] text-gray-500 font-bold block">Background Image URL</span>
                      <input 
                        type="text"
                        value={currentScene.background.image || ''}
                        onChange={(e) => {
                          const image = e.target.value;
                          pushToHistory({
                            ...state,
                            scenes: state.scenes.map(s => s.id === state.currentSceneId ? { ...s, background: { ...s.background, image } } : s)
                          });
                        }}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-[10px] font-mono focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                        placeholder="https://..."
                      />
                      <p className="text-[9px] text-gray-400 font-medium italic mt-1 px-1 line-clamp-2">Use high-quality PNG or JPG for backgrounds</p>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          ) : (
            <div className="flex flex-col p-5">
              <header className="flex items-center justify-between mb-6">
                <div className="flex flex-col">
                  <h2 className="text-sm font-black text-gray-900 flex items-center gap-2">
                    <Box size={14} className="text-brand-primary" /> {selectedElement.name}
                  </h2>
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{selectedElement.type}</span>
                </div>
                <button 
                  onClick={() => setState(p => ({ ...p, selectedElementId: null }))}
                  className="p-1 hover:bg-gray-100 rounded-md text-gray-400"
                >
                  <X size={16} />
                </button>
              </header>

              <div className="space-y-6">
                {/* Properties Section */}
                <section>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-3">Content & Appearance</label>
                  <div className="space-y-4">
                    {selectedElement.type !== 'quiz' && selectedElement.type !== 'image' && selectedElement.type !== 'video' && (
                      <div className="space-y-1">
                        <span className="text-[10px] text-gray-500 font-bold mb-1.5 block">Label / Text Content</span>
                        <textarea 
                          value={selectedElement.content || ''}
                          onChange={(e) => updateElement(selectedElement.id, { content: e.target.value })}
                          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-primary min-h-[80px] resize-y"
                          placeholder="Enter text content..."
                        />
                      </div>
                    )}

                    {(selectedElement.type === 'image' || selectedElement.type === 'video') && (
                      <div className="space-y-1">
                        <span className="text-[10px] text-gray-500 font-bold mb-1.5 block uppercase tracking-wider">{selectedElement.type === 'image' ? 'Image URL' : 'Video URL (YouTube/Vimeo)'}</span>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            value={selectedElement.src || ''}
                            onChange={(e) => updateElement(selectedElement.id, { src: e.target.value })}
                            className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-[10px] font-mono focus:outline-none focus:ring-2 focus:ring-brand-primary"
                            placeholder="https://..."
                          />
                        </div>
                        {selectedElement.type === 'video' && (
                          <p className="text-[9px] text-gray-400 font-medium italic mt-1">Paste a YouTube or Vimeo link to embed</p>
                        )}
                      </div>
                    )}

                    {/* Smart Positioning Tools */}
                    <div>
                      <span className="text-[10px] text-gray-500 font-bold mb-1.5 block uppercase tracking-wider">Positioning & Alignment</span>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleCenterElement(selectedElement.id, 'x')}
                          className="flex-1 py-2 bg-gray-50 border border-gray-200 rounded-lg text-[10px] font-black uppercase tracking-tight hover:bg-white hover:border-brand-primary transition-all flex flex-col items-center gap-1"
                        >
                          <AlignHorizontalJustifyCenter size={14} className="text-gray-400" />
                          Center H
                        </button>
                        <button 
                          onClick={() => handleCenterElement(selectedElement.id, 'y')}
                          className="flex-1 py-2 bg-gray-50 border border-gray-200 rounded-lg text-[10px] font-black uppercase tracking-tight hover:bg-white hover:border-brand-primary transition-all flex flex-col items-center gap-1"
                        >
                          <AlignVerticalJustifyCenter size={14} className="text-gray-400" />
                          Center V
                        </button>
                        <button 
                          onClick={() => handleCenterElement(selectedElement.id, 'both')}
                          className="flex-1 py-2 bg-brand-primary/5 border border-brand-primary/20 rounded-lg text-[10px] text-brand-primary font-black uppercase tracking-tight hover:bg-brand-primary hover:text-white transition-all flex flex-col items-center gap-1"
                        >
                          <Maximize size={14} />
                          Perfect Center
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mt-3">
                        <div className="relative group">
                          <span className="text-[9px] text-gray-400 font-bold mb-1 block uppercase">X Coordinate</span>
                          <input 
                            type="number" 
                            value={Math.round(selectedElement.x)}
                            onChange={(e) => updateElement(selectedElement.id, { x: parseInt(e.target.value) || 0 })}
                            className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-brand-primary"
                          />
                        </div>
                        <div className="relative group">
                          <span className="text-[9px] text-gray-400 font-bold mb-1 block uppercase">Y Coordinate</span>
                          <input 
                            type="number" 
                            value={Math.round(selectedElement.y)}
                            onChange={(e) => updateElement(selectedElement.id, { y: parseInt(e.target.value) || 0 })}
                            className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-brand-primary"
                          />
                        </div>
                      </div>
                    </div>

                    {['multiple-choice', 'checkbox', 'sequencing', 'matching', 'numberbox'].includes(selectedElement.type as any) && (
                      <div className="pt-4 border-t border-gray-100">
                        <span className="text-[10px] text-gray-400 font-bold mb-3 block uppercase tracking-wider">Item Scaling & Sizing</span>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-[10px] text-gray-500 font-bold mb-1.5 block">Item Width (px)</span>
                            <input 
                              type="number" 
                              value={selectedElement.style.itemWidth || ''}
                              onChange={(e) => updateStyle(selectedElement.id, { itemWidth: parseInt(e.target.value) || undefined })}
                              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-mono"
                              placeholder="Auto"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] text-gray-500 font-bold mb-1.5 block">Item Height (px)</span>
                            <input 
                              type="number" 
                              value={selectedElement.style.itemHeight || ''}
                              onChange={(e) => updateStyle(selectedElement.id, { itemHeight: parseInt(e.target.value) || undefined })}
                              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-mono"
                              placeholder="Auto"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] text-gray-500 font-bold mb-1 block flex justify-between">
                              Inner Padding <span>{selectedElement.style.itemPadding ?? (selectedElement.type === 'multiple-choice' ? 24 : 16)}px</span>
                            </span>
                            <input 
                              type="range" min="0" max="100" step="2"
                              value={selectedElement.style.itemPadding ?? (selectedElement.type === 'multiple-choice' ? 24 : 16)}
                              onChange={(e) => updateStyle(selectedElement.id, { itemPadding: parseInt(e.target.value) })}
                              className="w-full accent-brand-primary h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] text-gray-500 font-bold mb-1 block flex justify-between">
                              Gap Spacing <span>{selectedElement.style.itemSpacing || 16}px</span>
                            </span>
                            <input 
                              type="range" min="0" max="100" step="2"
                              value={selectedElement.style.itemSpacing || 16}
                              onChange={(e) => updateStyle(selectedElement.id, { itemSpacing: parseInt(e.target.value) })}
                              className="w-full accent-brand-secondary h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Image specific style */}
                    {selectedElement.type === 'image' && (
                      <div className="pt-4 border-t border-gray-100">
                        <span className="text-[10px] text-gray-400 font-bold mb-3 block uppercase tracking-wider">Image Composition</span>
                        <div>
                          <span className="text-[9px] text-gray-500 font-bold mb-1.5 block">Object Scaling</span>
                          <div className="flex p-0.5 bg-gray-100 rounded-lg">
                            {(['contain', 'cover', 'fill'] as const).map(fit => (
                              <button 
                                key={fit}
                                onClick={() => updateStyle(selectedElement.id, { objectFit: fit })}
                                className={`flex-1 py-1.5 text-[9px] font-black uppercase rounded ${selectedElement.style.objectFit === fit ? 'bg-white shadow-sm text-brand-primary' : 'text-gray-400'}`}
                              >
                                {fit}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Border & Styling Section */}
                    <div className="pt-4 border-t border-gray-100">
                      <span className="text-[10px] text-gray-400 font-bold mb-3 block uppercase tracking-wider">Borders & Decoration</span>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <span className="text-[9px] text-gray-500 font-bold mb-1 block flex justify-between">
                            Fill Color
                            {selectedElement.style.backgroundColor && (
                              <button onClick={() => updateStyle(selectedElement.id, { backgroundColor: 'transparent' })} className="text-[8px] text-brand-primary hover:underline">Clear</button>
                            )}
                          </span>
                          <input 
                            type="color" 
                            value={selectedElement.style.backgroundColor || '#ffffff'}
                            onChange={(e) => updateStyle(selectedElement.id, { backgroundColor: e.target.value })}
                            className="w-full h-8 bg-gray-100 border border-transparent rounded-lg px-1 py-1 cursor-pointer focus:bg-white"
                          />
                        </div>
                        <div>
                          <span className="text-[9px] text-gray-500 font-bold mb-1 block flex justify-between">
                            Border Color
                            {(selectedElement.style.borderColor) && (
                              <button onClick={() => updateStyle(selectedElement.id, { borderColor: undefined })} className="text-[8px] text-brand-primary hover:underline">Clear</button>
                            )}
                          </span>
                          <input 
                            type="color" 
                            value={selectedElement.style.borderColor || '#000000'}
                            onChange={(e) => updateStyle(selectedElement.id, { borderColor: e.target.value })}
                            className="w-full h-8 bg-gray-100 border border-transparent rounded-lg px-1 py-1 cursor-pointer focus:bg-white"
                          />
                        </div>
                        <div>
                          <span className="text-[9px] text-gray-500 font-bold mb-1 block">Border Width</span>
                          <input 
                            type="text" 
                            value={selectedElement.style.borderWidth || '0px'}
                            onChange={(e) => updateStyle(selectedElement.id, { borderWidth: e.target.value })}
                            className="w-full bg-gray-100 border border-transparent rounded-lg px-2 py-1.5 text-xs font-mono focus:bg-white focus:border-brand-primary/20"
                            placeholder="2px"
                          />
                        </div>
                        <div>
                          <span className="text-[9px] text-gray-500 font-bold mb-1 block">Border Style</span>
                          <select 
                            value={selectedElement.style.borderStyle || 'none'}
                            onChange={(e) => updateStyle(selectedElement.id, { borderStyle: e.target.value as any })}
                            className="w-full bg-gray-100 border border-transparent rounded-lg px-2 py-1.5 text-xs focus:bg-white focus:border-brand-primary/20"
                          >
                            <option value="none">None</option>
                            <option value="solid">Solid</option>
                            <option value="dashed">Dashed</option>
                            <option value="dotted">Dotted</option>
                            <option value="double">Double</option>
                          </select>
                        </div>
                        <div>
                          <span className="text-[9px] text-gray-500 font-bold mb-1 block">Corner Radius</span>
                          <input 
                            type="text" 
                            value={selectedElement.style.borderRadius || '12px'}
                            onChange={(e) => updateStyle(selectedElement.id, { borderRadius: e.target.value })}
                            className="w-full bg-gray-100 border border-transparent rounded-lg px-2 py-1.5 text-xs font-mono focus:bg-white focus:border-brand-primary/20"
                            placeholder="12px"
                          />
                        </div>
                      </div>
                    </div>

                    {selectedElement.type === 'quiz' && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <span className="text-[10px] text-gray-500 font-bold mb-1.5 block">Item Layout</span>
                            <div className="flex bg-gray-100 rounded-lg p-1">
                              {['grid', 'free'].map(mode => (
                                <button
                                  key={mode}
                                  onClick={() => updateStyle(selectedElement.id, { layoutMode: mode as any })}
                                  className={`flex-1 py-1 rounded-md text-[10px] uppercase font-black ${selectedElement.style.layoutMode === mode ? 'bg-white shadow-sm text-brand-primary' : 'text-gray-400'}`}
                                >
                                  {mode}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <span className="text-[10px] text-gray-500 font-bold mb-1.5 block">Orientation</span>
                            <div className="flex bg-gray-100 rounded-lg p-1">
                              {['horizontal', 'vertical'].map(o => (
                                <button
                                  key={o}
                                  onClick={() => updateStyle(selectedElement.id, { orientation: o as any })}
                                  className={`flex-1 py-1 rounded-md text-[10px] uppercase font-black ${selectedElement.style.orientation === o ? 'bg-white shadow-sm text-brand-primary' : 'text-gray-400'}`}
                                >
                                  {o[0]}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div>
                          <span className="text-[10px] text-gray-500 font-bold mb-1.5 block">Pair Gap ({selectedElement.style.pairGap || 60}px)</span>
                          <input 
                            type="range" min="20" max="300" step="10"
                            value={selectedElement.style.pairGap || 60}
                            onChange={(e) => updateStyle(selectedElement.id, { pairGap: parseInt(e.target.value) })}
                            className="w-full accent-brand-primary"
                          />
                        </div>

                        {/* List of Pairs */}
                        <div className="space-y-4 mt-4">
                          <span className="text-[10px] text-gray-500 font-bold mb-1.5 block">Manage Pairs</span>
                          {selectedElement.pairs?.map((pair, pIdx) => (
                            <div key={pair.id} className="p-3 bg-gray-50 rounded-lg border border-gray-100 flex flex-col gap-3 relative">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Pair #{pIdx + 1}</span>
                                <div className="flex items-center gap-1">
                                  <button 
                                    onClick={() => {
                                      const newPairs = [...(selectedElement.pairs || [])];
                                      const p = newPairs[pIdx];
                                      const tempType = p.leftType;
                                      const tempContent = p.leftContent;
                                      const tempSrc = p.leftSrc;
                                      
                                      p.leftType = p.rightType;
                                      p.leftContent = p.rightContent;
                                      p.leftSrc = p.rightSrc;
                                      
                                      p.rightType = tempType;
                                      p.rightContent = tempContent;
                                      p.rightSrc = tempSrc;
                                      
                                      updateElement(selectedElement.id, { pairs: newPairs });
                                    }}
                                    className="p-1 text-gray-400 hover:text-brand-primary"
                                    title="Swap Left/Right"
                                  >
                                    <ArrowLeftRight size={12} />
                                  </button>
                                  {pIdx > 0 && (
                                    <button 
                                      onClick={() => {
                                        const newPairs = [...(selectedElement.pairs || [])];
                                        const temp = newPairs[pIdx];
                                        newPairs[pIdx] = newPairs[pIdx - 1];
                                        newPairs[pIdx - 1] = temp;
                                        updateElement(selectedElement.id, { pairs: newPairs });
                                      }}
                                      className="p-1 text-gray-400 hover:text-brand-primary"
                                    >
                                      <Plus size={12} className="rotate-180" style={{ transform: 'rotate(180deg) translateY(-1px)' }} />
                                    </button>
                                  )}
                                  {pIdx < (selectedElement.pairs?.length || 0) - 1 && (
                                    <button 
                                      onClick={() => {
                                        const newPairs = [...(selectedElement.pairs || [])];
                                        const temp = newPairs[pIdx];
                                        newPairs[pIdx] = newPairs[pIdx + 1];
                                        newPairs[pIdx + 1] = temp;
                                        updateElement(selectedElement.id, { pairs: newPairs });
                                      }}
                                      className="p-1 text-gray-400 hover:text-brand-primary"
                                    >
                                      <ChevronDown size={12} />
                                    </button>
                                  )}
                                  <button 
                                    onClick={() => {
                                      const newPairs = selectedElement.pairs?.filter(p => p.id !== pair.id);
                                      updateElement(selectedElement.id, { pairs: newPairs });
                                    }}
                                    className="text-red-400 hover:text-red-600 p-1"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-3">
                                {/* Left Side */}
                                <div className="space-y-2">
                                  <select 
                                    value={pair.leftType}
                                    onChange={(e) => {
                                      const newPairs = [...(selectedElement.pairs || [])];
                                      newPairs[pIdx].leftType = e.target.value as any;
                                      updateElement(selectedElement.id, { pairs: newPairs });
                                    }}
                                    className="w-full text-[10px] p-1.5 bg-white border border-gray-200 rounded focus:ring-1 focus:ring-brand-primary outline-none"
                                  >
                                    <option value="text">Text</option>
                                    <option value="image">Image</option>
                                    <option value="icon">Icon</option>
                                  </select>
                                  {pair.leftType === 'image' ? (
                                    <div className="space-y-1">
                                      <textarea 
                                        value={pair.leftSrc || ''} 
                                        placeholder="Image URL"
                                        onChange={(e) => {
                                          const newPairs = [...(selectedElement.pairs || [])];
                                          newPairs[pIdx].leftSrc = e.target.value;
                                          updateElement(selectedElement.id, { pairs: newPairs });
                                        }}
                                        className="w-full text-[10px] p-2 bg-white border border-gray-200 rounded mb-1 min-h-[34px] resize-none"
                                      />
                                      <label className="block">
                                        <div className="w-full py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-[10px] font-bold rounded flex items-center justify-center gap-1 cursor-pointer transition-colors">
                                          <Download size={10} /> Upload
                                        </div>
                                        <input 
                                          type="file" 
                                          className="hidden" 
                                          accept="image/*"
                                          onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                              const reader = new FileReader();
                                              reader.onloadend = () => {
                                                const newPairs = [...(selectedElement.pairs || [])];
                                                newPairs[pIdx].leftSrc = reader.result as string;
                                                updateElement(selectedElement.id, { pairs: newPairs });
                                              };
                                              reader.readAsDataURL(file);
                                            }
                                          }}
                                        />
                                      </label>
                                    </div>
                                  ) : (
                                    <textarea 
                                      value={pair.leftContent || ''} 
                                      placeholder={pair.leftType === 'icon' ? 'Select Emoji' : 'Enter Text (Press Enter for new line)'}
                                      onChange={(e) => {
                                        const newPairs = [...(selectedElement.pairs || [])];
                                        newPairs[pIdx].leftContent = e.target.value;
                                        updateElement(selectedElement.id, { pairs: newPairs });
                                      }}
                                      className="w-full text-[10px] p-2 bg-white border border-gray-200 rounded min-h-[60px] resize-none"
                                    />
                                  )}
                                </div>

                                {/* Right Side */}
                                <div className="space-y-2">
                                  <select 
                                    value={pair.rightType}
                                    onChange={(e) => {
                                      const newPairs = [...(selectedElement.pairs || [])];
                                      newPairs[pIdx].rightType = e.target.value as any;
                                      updateElement(selectedElement.id, { pairs: newPairs });
                                    }}
                                    className="w-full text-[10px] p-1.5 bg-white border border-gray-200 rounded focus:ring-1 focus:ring-brand-primary outline-none"
                                  >
                                    <option value="text">Text</option>
                                    <option value="image">Image</option>
                                    <option value="icon">Icon</option>
                                  </select>
                                  {pair.rightType === 'image' ? (
                                    <div className="space-y-1">
                                      <textarea 
                                        value={pair.rightSrc || ''} 
                                        placeholder="Image URL"
                                        onChange={(e) => {
                                          const newPairs = [...(selectedElement.pairs || [])];
                                          newPairs[pIdx].rightSrc = e.target.value;
                                          updateElement(selectedElement.id, { pairs: newPairs });
                                        }}
                                        className="w-full text-[10px] p-2 bg-white border border-gray-200 rounded mb-1 min-h-[34px] resize-none"
                                      />
                                      <label className="block">
                                        <div className="w-full py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-[10px] font-bold rounded flex items-center justify-center gap-1 cursor-pointer transition-colors">
                                          <Download size={10} /> Upload
                                        </div>
                                        <input 
                                          type="file" 
                                          className="hidden" 
                                          accept="image/*"
                                          onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                              const reader = new FileReader();
                                              reader.onloadend = () => {
                                                const newPairs = [...(selectedElement.pairs || [])];
                                                newPairs[pIdx].rightSrc = reader.result as string;
                                                updateElement(selectedElement.id, { pairs: newPairs });
                                              };
                                              reader.readAsDataURL(file);
                                            }
                                          }}
                                        />
                                      </label>
                                    </div>
                                  ) : (
                                    <textarea 
                                      value={pair.rightContent || ''} 
                                      placeholder={pair.rightType === 'icon' ? 'Select Emoji' : 'Enter Text (Press Enter for new line)'}
                                      onChange={(e) => {
                                        const newPairs = [...(selectedElement.pairs || [])];
                                        newPairs[pIdx].rightContent = e.target.value;
                                        updateElement(selectedElement.id, { pairs: newPairs });
                                      }}
                                      className="w-full text-[10px] p-2 bg-white border border-gray-200 rounded min-h-[60px] resize-none"
                                    />
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                          <button 
                            onClick={() => {
                              const newPair = { id: `p-${Date.now()}`, leftType: 'text' as const, leftContent: 'Question', rightType: 'text' as const, rightContent: 'Answer' };
                              updateElement(selectedElement.id, { pairs: [...(selectedElement.pairs || []), newPair] });
                            }}
                            className="w-full py-2 bg-brand-primary/10 text-brand-primary text-[10px] font-bold rounded-lg border border-dashed border-brand-primary hover:bg-brand-primary/20 transition-all"
                          >
                            + Add Another Pair
                          </button>
                        </div>
                      </div>
                    )}

                    {selectedElement.type === 'sequencing' && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <span className="text-[10px] text-gray-500 font-bold mb-1.5 block">Order Mode</span>
                            <div className="flex bg-gray-100 rounded-lg p-1">
                              {['auto', 'manual'].map(m => (
                                <button
                                  key={m}
                                  onClick={() => updateStyle(selectedElement.id, { orderingMode: m as any })}
                                  className={`flex-1 py-1 rounded-md text-[10px] uppercase font-black ${selectedElement.style.orderingMode === m ? 'bg-white shadow-sm text-brand-primary' : 'text-gray-400'}`}
                                >
                                  {m}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <span className="text-[10px] text-gray-500 font-bold mb-1.5 block">Layout Mode</span>
                            <div className="flex bg-gray-100 rounded-lg p-1">
                              {['grid', 'free'].map(l => (
                                <button
                                  key={l}
                                  onClick={() => updateStyle(selectedElement.id, { layoutMode: l as any })}
                                  className={`flex-1 py-1 rounded-md text-[10px] uppercase font-black ${selectedElement.style.layoutMode === l ? 'bg-white shadow-sm text-brand-primary' : 'text-gray-400'}`}
                                >
                                  {l}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div>
                          <span className="text-[10px] text-gray-500 font-bold mb-1.5 block">Question Text</span>
                          <textarea 
                            value={selectedElement.content || ''}
                            onChange={(e) => updateElement(selectedElement.id, { content: e.target.value })}
                            className="w-full text-xs p-2 bg-gray-50 border border-gray-200 rounded-lg min-h-[60px] resize-none focus:ring-1 focus:ring-brand-primary outline-none"
                            placeholder="Example: Put these in correct order"
                          />
                        </div>

                        <div className="space-y-4">
                          <span className="text-[10px] text-gray-500 font-bold mb-1.5 block">Step Sequence Details</span>
                          {selectedElement.choices?.map((choice, cIdx) => (
                            <div key={choice.id} className="p-3 rounded-lg border-2 bg-gray-50 border-gray-100 flex flex-col gap-3 relative">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Step #{cIdx + 1}</span>
                                  <div className="flex items-center gap-1 bg-white border border-gray-200 rounded px-1.5 py-0.5">
                                    <span className="text-[9px] text-gray-400 font-bold">Pos:</span>
                                    <input 
                                      type="number"
                                      value={choice.orderIndex || (cIdx + 1)}
                                      onChange={(e) => {
                                        const newChoices = [...(selectedElement.choices || [])];
                                        newChoices[cIdx].orderIndex = parseInt(e.target.value);
                                        updateElement(selectedElement.id, { choices: newChoices });
                                      }}
                                      className="w-8 text-[10px] font-bold text-brand-primary outline-none"
                                    />
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button 
                                    onClick={() => handleDuplicateChoice(selectedElement.id, choice.id)}
                                    className="text-blue-400 hover:text-blue-600 p-1"
                                    title="Duplicate"
                                  >
                                    <Copy size={12} />
                                  </button>
                                  <button 
                                    onClick={() => {
                                      const newChoices = selectedElement.choices?.filter(c => c.id !== choice.id);
                                      updateElement(selectedElement.id, { choices: newChoices });
                                    }}
                                    className="text-red-400 hover:text-red-600 p-1"
                                    title="Delete"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>

                              <div className="space-y-2">
                                <select 
                                  value={choice.type}
                                  onChange={(e) => {
                                    const newChoices = [...(selectedElement.choices || [])];
                                    newChoices[cIdx].type = e.target.value as any;
                                    updateElement(selectedElement.id, { choices: newChoices });
                                  }}
                                  className="w-full text-[10px] p-1.5 bg-white border border-gray-200 rounded"
                                >
                                  <option value="text">Text Step</option>
                                  <option value="image">Image Step</option>
                                  <option value="icon">Icon Step</option>
                                </select>

                                {choice.type === 'image' ? (
                                  <div className="space-y-1">
                                    <input 
                                      type="text" 
                                      value={choice.src || ''} 
                                      placeholder="Image URL"
                                      onChange={(e) => {
                                        const newChoices = [...(selectedElement.choices || [])];
                                        newChoices[cIdx].src = e.target.value;
                                        updateElement(selectedElement.id, { choices: newChoices });
                                      }}
                                      className="w-full text-[10px] p-1.5 bg-white border border-gray-200 rounded"
                                    />
                                    <label className="block">
                                      <div className="w-full py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 text-[10px] font-bold rounded flex items-center justify-center gap-1 cursor-pointer transition-colors">
                                        <Download size={10} /> Upload
                                      </div>
                                      <input 
                                        type="file" 
                                        className="hidden" 
                                        accept="image/*"
                                        onChange={(e) => {
                                          const file = e.target.files?.[0];
                                          if (file) {
                                            const reader = new FileReader();
                                            reader.onloadend = () => {
                                              const newChoices = [...(selectedElement.choices || [])];
                                              newChoices[cIdx].src = reader.result as string;
                                              updateElement(selectedElement.id, { choices: newChoices });
                                            };
                                            reader.readAsDataURL(file);
                                          }
                                        }}
                                      />
                                    </label>
                                  </div>
                                ) : (
                                  <textarea 
                                    value={choice.content || ''} 
                                    placeholder={choice.type === 'icon' ? 'Enter Emoji' : 'Enter Text Content'}
                                    onChange={(e) => {
                                      const newChoices = [...(selectedElement.choices || [])];
                                      newChoices[cIdx].content = e.target.value;
                                      updateElement(selectedElement.id, { choices: newChoices });
                                    }}
                                    className="w-full text-[10px] p-2 bg-white border border-gray-200 rounded min-h-[40px] resize-none"
                                  />
                                )}

                                {selectedElement.style.layoutMode === 'free' && (
                                  <div className="grid grid-cols-2 gap-2 pt-1">
                                    <div className="flex flex-col gap-0.5">
                                      <span className="text-[9px] text-gray-400 font-bold uppercase">X Pos</span>
                                      <input 
                                        type="number"
                                        value={choice.x || 0}
                                        onChange={(e) => {
                                          const newChoices = [...(selectedElement.choices || [])];
                                          newChoices[cIdx].x = parseInt(e.target.value);
                                          updateElement(selectedElement.id, { choices: newChoices });
                                        }}
                                        className="w-full text-[10px] p-1.5 border border-gray-200 rounded"
                                      />
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                      <span className="text-[9px] text-gray-400 font-bold uppercase">Y Pos</span>
                                      <input 
                                        type="number"
                                        value={choice.y || 0}
                                        onChange={(e) => {
                                          const newChoices = [...(selectedElement.choices || [])];
                                          newChoices[cIdx].y = parseInt(e.target.value);
                                          updateElement(selectedElement.id, { choices: newChoices });
                                        }}
                                        className="w-full text-[10px] p-1.5 border border-gray-200 rounded"
                                      />
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                      <span className="text-[9px] text-gray-400 font-bold uppercase">Width</span>
                                      <input 
                                        type="number"
                                        value={choice.width || (choice.type === 'image' ? 120 : 0)}
                                        placeholder="Auto"
                                        onChange={(e) => {
                                          const newChoices = [...(selectedElement.choices || [])];
                                          newChoices[cIdx].width = parseInt(e.target.value);
                                          updateElement(selectedElement.id, { choices: newChoices });
                                        }}
                                        className="w-full text-[10px] p-1.5 border border-gray-200 rounded"
                                      />
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                      <span className="text-[9px] text-gray-400 font-bold uppercase">Height</span>
                                      <input 
                                        type="number"
                                        value={choice.height || (choice.type === 'image' ? 120 : 0)}
                                        placeholder="Auto"
                                        onChange={(e) => {
                                          const newChoices = [...(selectedElement.choices || [])];
                                          newChoices[cIdx].height = parseInt(e.target.value);
                                          updateElement(selectedElement.id, { choices: newChoices });
                                        }}
                                        className="w-full text-[10px] p-1.5 border border-gray-200 rounded"
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                          <button 
                            onClick={() => {
                              const newChoice = { id: `c-${Date.now()}`, type: 'text' as const, content: 'New Step', isCorrect: true, x: 0, y: 0 };
                              updateElement(selectedElement.id, { choices: [...(selectedElement.choices || []), newChoice] });
                            }}
                            className="w-full py-2 bg-brand-primary/10 text-brand-primary text-[10px] font-bold rounded-lg border border-dashed border-brand-primary hover:bg-brand-primary/20 transition-all"
                          >
                            + Add Step Item
                          </button>
                        </div>
                      </div>
                    )}
                    {['multiple-choice', 'checkbox', 'numberbox'].includes(selectedElement.type) && (
                      <div className="space-y-4">
                        <div className="p-3 bg-brand-primary/5 rounded-xl border border-brand-primary/20">
                          <span className="text-[10px] text-brand-primary font-black mb-2 block uppercase tracking-wider">Widget Type</span>
                          <div className="grid grid-cols-3 gap-1">
                            {[
                              { id: 'multiple-choice', label: 'Choices', icon: Layers },
                              { id: 'checkbox', label: 'Checks', icon: CheckSquare },
                              { id: 'numberbox', label: 'Num Inputs', icon: Hash }
                            ].map(t => (
                              <button
                                key={t.id}
                                onClick={() => updateElement(selectedElement.id, { type: t.id as any })}
                                className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all ${selectedElement.type === t.id ? 'bg-white shadow-sm ring-1 ring-brand-primary' : 'hover:bg-white/50 text-gray-400'}`}
                              >
                                <t.icon size={14} className={selectedElement.type === t.id ? 'text-brand-primary' : 'text-gray-400'} />
                                <span className={`text-[8px] font-bold uppercase ${selectedElement.type === t.id ? 'text-brand-primary' : 'text-gray-400'}`}>{t.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Common Logic for all three */}
                        <div className="space-y-4">
                          {/* Layout & Spacing Controls */}
                          <div className="grid grid-cols-2 gap-3">
                            {selectedElement.type === 'multiple-choice' && (
                              <div>
                                <span className="text-[10px] text-gray-500 font-bold mb-1.5 block">Choice Layout</span>
                                <div className="flex bg-gray-100 rounded-lg p-1">
                                  {['horizontal', 'vertical', 'free'].map(o => (
                                    <button
                                      key={o}
                                      onClick={() => updateStyle(selectedElement.id, { choiceLayout: o as any })}
                                      className={`flex-1 py-1 rounded-md text-[10px] uppercase font-black ${selectedElement.style.choiceLayout === o ? 'bg-white shadow-sm text-brand-primary' : 'text-gray-400'}`}
                                    >
                                      {o === 'free' ? 'F' : o[0]}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                            <div className={selectedElement.type !== 'multiple-choice' ? 'col-span-2' : ''}>
                              <span className="text-[10px] text-gray-500 font-bold mb-1.5 block">Item Spacing ({selectedElement.style.itemSpacing || 12}px)</span>
                              <input 
                                type="range" min="0" max="100" step="2"
                                value={selectedElement.style.itemSpacing || 12}
                                onChange={(e) => updateStyle(selectedElement.id, { itemSpacing: parseInt(e.target.value) })}
                                className="w-full accent-brand-primary"
                              />
                            </div>
                          </div>

                          {/* Question Content */}
                          <div>
                            <span className="text-[10px] text-gray-500 font-bold mb-1.5 block">Question / Heading Text</span>
                            <textarea 
                              value={selectedElement.content || ''}
                              onChange={(e) => updateElement(selectedElement.id, { content: e.target.value })}
                              className="w-full text-xs p-2 bg-gray-50 border border-gray-200 rounded-lg min-h-[60px] resize-none focus:ring-1 focus:ring-brand-primary outline-none"
                              placeholder="Enter your question or heading here..."
                            />
                          </div>

                          {selectedElement.type === 'multiple-choice' && (
                            <div className="space-y-4">
                              {/* Quick Templates */}
                              <div>
                                <span className="text-[10px] text-gray-500 font-bold mb-1.5 block">Quick Templates</span>
                                <div className="grid grid-cols-3 gap-2">
                                  <button 
                                    onClick={() => {
                                      updateElement(selectedElement.id, {
                                        choices: [
                                          { id: `c-yes-${Date.now()}`, type: 'text', content: 'Yes', isCorrect: true },
                                          { id: `c-no-${Date.now()}`, type: 'text', content: 'No', isCorrect: false }
                                        ]
                                      });
                                    }}
                                    className="py-1.5 px-2 bg-white border border-gray-200 rounded text-[9px] font-bold hover:border-brand-primary transition-all"
                                  >
                                    Yes / No
                                  </button>
                                  <button 
                                    onClick={() => {
                                      updateElement(selectedElement.id, {
                                        choices: [
                                          { id: `c-right-${Date.now()}`, type: 'icon', content: '✅', isCorrect: true },
                                          { id: `c-wrong-${Date.now()}`, type: 'icon', content: '❌', isCorrect: false }
                                        ]
                                      });
                                    }}
                                    className="py-1.5 px-2 bg-white border border-gray-200 rounded text-[9px] font-bold hover:border-brand-primary transition-all"
                                  >
                                    Icons (✓/✗)
                                  </button>
                                  <button 
                                    onClick={() => {
                                      updateElement(selectedElement.id, {
                                        choices: [
                                          { id: `c-happy-${Date.now()}`, type: 'icon', content: '😊', isCorrect: true },
                                          { id: `c-sad-${Date.now()}`, type: 'icon', content: '☹️', isCorrect: false }
                                        ]
                                      });
                                    }}
                                    className="py-1.5 px-2 bg-white border border-gray-200 rounded text-[9px] font-bold hover:border-brand-primary transition-all"
                                  >
                                    Mood (😊/☹️)
                                  </button>
                                </div>
                              </div>

                              {/* Choice Alignment */}
                              <div>
                                <span className="text-[10px] text-gray-500 font-bold mb-1.5 block">Choice Alignment</span>
                                <div className="flex bg-gray-100 rounded-lg p-1">
                                  {['left', 'center', 'right'].map(a => (
                                    <button
                                      key={a}
                                      onClick={() => updateStyle(selectedElement.id, { choiceAlign: a as any })}
                                      className={`flex-1 py-1 rounded-md text-[10px] uppercase font-black ${selectedElement.style.choiceAlign === a ? 'bg-white shadow-sm text-brand-primary' : 'text-gray-400'}`}
                                    >
                                      {a[0]}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* List of Choices/Items */}
                          <div className="space-y-4">
                            <span className="text-[10px] text-gray-500 font-bold mb-1.5 block">Manage Items</span>
                            {selectedElement.choices?.map((choice, cIdx) => (
                              <div key={choice.id} className={`p-3 rounded-lg border-2 flex flex-col gap-3 relative transition-all ${choice.isCorrect ? 'border-green-200 bg-green-50/30' : 'bg-gray-50 border-gray-100'}`}>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Item #{cIdx + 1}</span>
                                    {selectedElement.type === 'multiple-choice' && (
                                      <button 
                                        onClick={() => {
                                          const newChoices = selectedElement.choices?.map(c => ({
                                            ...c,
                                            isCorrect: c.id === choice.id
                                          }));
                                          updateElement(selectedElement.id, { choices: newChoices });
                                        }}
                                        className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${choice.isCorrect ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400 hover:bg-gray-300'}`}
                                      >
                                        {choice.isCorrect ? 'Correct' : 'Mark Correct'}
                                      </button>
                                    )}
                                    {selectedElement.type === 'checkbox' && (
                                      <button 
                                        onClick={() => {
                                          const newChoices = selectedElement.choices?.map(c => 
                                            c.id === choice.id ? { ...c, isCorrect: !c.isCorrect } : c
                                          );
                                          updateElement(selectedElement.id, { choices: newChoices });
                                        }}
                                        className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${choice.isCorrect ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400 hover:bg-gray-300'}`}
                                      >
                                        {choice.isCorrect ? 'Correct' : 'Mark Correct'}
                                      </button>
                                    )}
                                    {selectedElement.type === 'numberbox' && (
                                      <div className="flex items-center gap-1">
                                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${choice.answer ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'}`}>
                                          {choice.answer ? 'Has Answer' : 'No Answer'}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button 
                                      onClick={() => handleDuplicateChoice(selectedElement.id, choice.id)}
                                      className="text-blue-400 hover:text-blue-600 p-1"
                                      title="Duplicate Item"
                                    >
                                      <Copy size={12} />
                                    </button>
                                    <button 
                                      onClick={() => {
                                        const newChoices = selectedElement.choices?.filter(c => c.id !== choice.id);
                                        updateElement(selectedElement.id, { choices: newChoices });
                                      }}
                                      className="text-red-400 hover:text-red-600 p-1"
                                      title="Delete Item"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </div>

                                <div className="space-y-2">
                                  <select 
                                    value={choice.type}
                                    onChange={(e) => {
                                      const newChoices = [...(selectedElement.choices || [])];
                                      newChoices[cIdx].type = e.target.value as any;
                                      updateElement(selectedElement.id, { choices: newChoices });
                                    }}
                                    className="w-full text-[10px] p-1.5 bg-white border border-gray-200 rounded focus:ring-1 focus:ring-brand-primary outline-none"
                                  >
                                    <option value="text">Text / Label</option>
                                    <option value="image">Image Item</option>
                                    <option value="icon">Icon / Emoji</option>
                                  </select>

                                  {choice.type === 'image' ? (
                                    <div className="space-y-1">
                                      <textarea 
                                        value={choice.src || ''} 
                                        placeholder="Image URL"
                                        onChange={(e) => {
                                          const newChoices = [...(selectedElement.choices || [])];
                                          newChoices[cIdx].src = e.target.value;
                                          updateElement(selectedElement.id, { choices: newChoices });
                                        }}
                                        className="w-full text-[10px] p-2 bg-white border border-gray-200 rounded mb-1 min-h-[34px] resize-none"
                                      />
                                      <label className="block">
                                        <div className="w-full py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-[10px] font-bold rounded flex items-center justify-center gap-1 cursor-pointer transition-colors">
                                          <Download size={10} /> Upload Image
                                        </div>
                                        <input 
                                          type="file" 
                                          className="hidden" 
                                          accept="image/*"
                                          onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                              const reader = new FileReader();
                                              reader.onloadend = () => {
                                                const newChoices = [...(selectedElement.choices || [])];
                                                newChoices[cIdx].src = reader.result as string;
                                                updateElement(selectedElement.id, { choices: newChoices });
                                              };
                                              reader.readAsDataURL(file);
                                            }
                                          }}
                                        />
                                      </label>
                                    </div>
                                  ) : (
                                    <textarea 
                                      value={choice.content || ''} 
                                      placeholder={choice.type === 'icon' ? 'Enter Emoji' : 'Enter Item Label'}
                                      onChange={(e) => {
                                        const newChoices = [...(selectedElement.choices || [])];
                                        newChoices[cIdx].content = e.target.value;
                                        updateElement(selectedElement.id, { choices: newChoices });
                                      }}
                                      className="w-full text-[10px] p-2 bg-white border border-gray-200 rounded min-h-[40px] resize-none"
                                    />
                                  )}

                                  {(selectedElement.style.choiceLayout === 'free' || selectedElement.style.layoutMode === 'free') && (
                                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-100 mt-2">
                                      <div className="flex flex-col gap-0.5">
                                        <span className="text-[9px] text-gray-400 font-bold uppercase">X Pos</span>
                                        <input 
                                          type="number"
                                          value={choice.x || 0}
                                          onChange={(e) => {
                                            const newChoices = [...(selectedElement.choices || [])];
                                            newChoices[cIdx].x = parseInt(e.target.value) || 0;
                                            updateElement(selectedElement.id, { choices: newChoices });
                                          }}
                                          className="w-full text-[10px] p-1.5 border border-gray-200 rounded font-mono"
                                        />
                                      </div>
                                      <div className="flex flex-col gap-0.5">
                                        <span className="text-[9px] text-gray-400 font-bold uppercase">Y Pos</span>
                                        <input 
                                          type="number"
                                          value={choice.y || 0}
                                          onChange={(e) => {
                                            const newChoices = [...(selectedElement.choices || [])];
                                            newChoices[cIdx].y = parseInt(e.target.value) || 0;
                                            updateElement(selectedElement.id, { choices: newChoices });
                                          }}
                                          className="w-full text-[10px] p-1.5 border border-gray-200 rounded font-mono"
                                        />
                                      </div>
                                    </div>
                                  )}

                                  {selectedElement.type === 'numberbox' && (
                                    <div className="mt-2 pt-2 border-t border-gray-200">
                                      <span className="text-[9px] text-gray-400 font-bold uppercase mb-1.5 block">Correct Value (Text/Num/Sign)</span>
                                      <input 
                                        type="text"
                                        value={choice.answer || ''}
                                        onChange={(e) => {
                                          const newChoices = [...(selectedElement.choices || [])];
                                          newChoices[cIdx].answer = e.target.value;
                                          newChoices[cIdx].isCorrect = e.target.value.trim() !== '';
                                          updateElement(selectedElement.id, { choices: newChoices });
                                        }}
                                        className="w-full text-xs p-2 bg-white border border-gray-200 rounded focus:ring-1 focus:ring-brand-primary outline-none font-mono"
                                        placeholder="Enter correct answer..."
                                      />
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                            <button 
                              onClick={() => {
                                const newChoice = { id: `c-${Date.now()}`, type: 'text' as const, content: 'Text Label', isCorrect: false };
                                updateElement(selectedElement.id, { choices: [...(selectedElement.choices || []), newChoice] });
                              }}
                              className="w-full py-2 bg-brand-primary/10 text-brand-primary text-[10px] font-bold rounded-lg border border-dashed border-brand-primary hover:bg-brand-primary/20 transition-all"
                            >
                              + Add Item
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {selectedElement.type === 'fill-in-the-blank' && (
                      <div className="space-y-4">
                        <div className="space-y-3">
                          <span className="text-[10px] text-gray-500 font-bold mb-1.5 block">Question Asset (Image/Icon)</span>
                          <div className="flex gap-2">
                             <input 
                               type="text"
                               placeholder="Image URL..."
                               value={selectedElement.src || ''}
                               onChange={(e) => updateElement(selectedElement.id, { src: e.target.value })}
                               className="flex-1 text-[10px] p-2 bg-gray-50 border border-gray-200 rounded focus:ring-1 focus:ring-brand-primary outline-none"
                             />
                             <label className="p-2 bg-gray-100 hover:bg-gray-200 rounded cursor-pointer transition-colors shrink-0">
                               <Download size={14} className="text-gray-600" />
                               <input 
                                 type="file" 
                                 className="hidden" 
                                 accept="image/*"
                                 onChange={(e) => {
                                   const file = e.target.files?.[0];
                                   if (file) {
                                     const reader = new FileReader();
                                     reader.onloadend = () => updateElement(selectedElement.id, { src: reader.result as string });
                                     reader.readAsDataURL(file);
                                   }
                                 }}
                               />
                             </label>
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] text-gray-500 font-bold block">Question Template</span>
                            <span className="text-[9px] text-brand-primary font-bold bg-brand-primary/10 px-1.5 py-0.5 rounded">Use [blank]</span>
                          </div>
                          <textarea 
                            value={selectedElement.content || ''}
                            onChange={(e) => {
                              const newContent = e.target.value;
                              const blanksCount = (newContent.match(/\[blank\]/g) || []).length;
                              const currentBlanks = selectedElement.blanks || [];
                              let newBlanks = [...currentBlanks];
                              
                              if (blanksCount > currentBlanks.length) {
                                for (let i = currentBlanks.length; i < blanksCount; i++) {
                                  newBlanks.push({ id: `b-${Date.now()}-${i}`, answer: '', placeholder: 'Answer...' });
                                }
                              } else if (blanksCount < currentBlanks.length) {
                                newBlanks = newBlanks.slice(0, blanksCount);
                              }
                              
                              updateElement(selectedElement.id, { content: newContent, blanks: newBlanks });
                            }}
                            className="w-full text-xs p-2 bg-gray-50 border border-gray-200 rounded-lg min-h-[80px] resize-none focus:ring-1 focus:ring-brand-primary outline-none"
                            placeholder="Example: The sky is [blank]."
                          />
                        </div>

                        <div className="space-y-3">
                          <span className="text-[10px] text-gray-500 font-bold mb-1.5 block">Configure Blanks</span>
                          {selectedElement.blanks?.map((blank, bIdx) => (
                            <div key={blank.id} className="p-3 bg-gray-50 rounded-lg border border-gray-100 space-y-2">
                              <span className="text-[10px] font-black text-gray-400">Blank #{bIdx + 1}</span>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <span className="text-[9px] text-gray-400 block mb-1">Correct Answer</span>
                                  <input 
                                    type="text"
                                    value={blank.answer}
                                    onChange={(e) => {
                                      const newBlanks = [...(selectedElement.blanks || [])];
                                      newBlanks[bIdx].answer = e.target.value;
                                      updateElement(selectedElement.id, { blanks: newBlanks });
                                    }}
                                    className="w-full text-[10px] p-1.5 bg-white border border-gray-200 rounded"
                                  />
                                </div>
                                <div>
                                  <span className="text-[9px] text-gray-400 block mb-1">Placeholder</span>
                                  <input 
                                    type="text"
                                    value={blank.placeholder || ''}
                                    onChange={(e) => {
                                      const newBlanks = [...(selectedElement.blanks || [])];
                                      newBlanks[bIdx].placeholder = e.target.value;
                                      updateElement(selectedElement.id, { blanks: newBlanks });
                                    }}
                                    className="w-full text-[10px] p-1.5 bg-white border border-gray-200 rounded"
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="h-px bg-gray-100 my-4" />
                      </div>
                    )}
                    
                    <div className="space-y-4">
                      {/* Font Selection */}
                      <div>
                        <span className="text-[10px] text-gray-500 font-bold mb-1.5 block uppercase">Font Family</span>
                        <select 
                          value={selectedElement.style.fontFamily || 'Inter'} 
                          onChange={(e) => updateStyle(selectedElement.id, { fontFamily: e.target.value })}
                          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-medium"
                          style={{ fontFamily: selectedElement.style.fontFamily }}
                        >
                          {FAMOUS_FONTS.map(font => (
                            <option key={font} value={font} style={{ fontFamily: font }}>{font}</option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <span className="text-[10px] text-gray-500 font-bold mb-1.5 block uppercase">Font Size (px)</span>
                          <input 
                            type="number"
                            value={parseInt(selectedElement.style.fontSize || '20')} 
                            onChange={(e) => updateStyle(selectedElement.id, { fontSize: `${e.target.value}px` })}
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono"
                            min="8"
                            max="120"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-gray-500 font-bold mb-1.5 block uppercase">Weight</span>
                          <select 
                            value={selectedElement.style.fontWeight || '500'} 
                            onChange={(e) => updateStyle(selectedElement.id, { fontWeight: e.target.value })}
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-medium"
                          >
                            <option value="300">Light</option>
                            <option value="400">Regular</option>
                            <option value="500">Medium</option>
                            <option value="600">Semi Bold</option>
                            <option value="700">Bold</option>
                            <option value="900">Black</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <span className="text-[10px] text-gray-500 font-bold mb-1.5 block uppercase">Styles</span>
                          <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
                            <button
                              onClick={() => updateStyle(selectedElement.id, { fontStyle: selectedElement.style.fontStyle === 'italic' ? 'normal' : 'italic' })}
                              className={`flex-1 py-1.5 rounded-md flex justify-center items-center ${selectedElement.style.fontStyle === 'italic' ? 'bg-white shadow-sm text-brand-primary' : 'text-gray-400'}`}
                            >
                              <Italic size={14} />
                            </button>
                            <button
                              onClick={() => updateStyle(selectedElement.id, { textDecoration: selectedElement.style.textDecoration === 'underline' ? 'none' : 'underline' })}
                              className={`flex-1 py-1.5 rounded-md flex justify-center items-center ${selectedElement.style.textDecoration === 'underline' ? 'bg-white shadow-sm text-brand-primary' : 'text-gray-400'}`}
                            >
                              <Underline size={14} />
                            </button>
                          </div>
                        </div>
                        <div>
                          <span className="text-[10px] text-gray-500 font-bold mb-1.5 block uppercase">Case</span>
                          <div className="flex bg-gray-100 rounded-lg p-1">
                            {['none', 'uppercase', 'lowercase', 'capitalize', 'small-caps'].map(transform => (
                              <button
                                key={transform}
                                onClick={() => {
                                  if (transform === 'small-caps') {
                                    updateStyle(selectedElement.id, { fontVariant: selectedElement.style.fontVariant === 'small-caps' ? 'normal' : 'small-caps' });
                                  } else {
                                    updateStyle(selectedElement.id, { textTransform: transform as any });
                                  }
                                }}
                                className={`flex-1 py-1.5 rounded-md text-[9px] font-bold ${
                                  (transform === 'small-caps' && selectedElement.style.fontVariant === 'small-caps') || 
                                  (transform !== 'small-caps' && selectedElement.style.textTransform === transform) 
                                    ? 'bg-white shadow-sm text-brand-primary' 
                                    : 'text-gray-400'
                                }`}
                              >
                                {transform === 'none' ? 'Aa' : 
                                 transform === 'uppercase' ? 'AA' : 
                                 transform === 'lowercase' ? 'aa' : 
                                 transform === 'capitalize' ? 'Ab' : 'aA'}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <span className="text-[10px] text-gray-500 font-bold mb-1.5 block uppercase">Text Align</span>
                          <div className="flex bg-gray-100 rounded-lg p-1">
                            {['left', 'center', 'right'].map(align => (
                              <button
                                key={align}
                                onClick={() => updateStyle(selectedElement.id, { textAlign: align as any })}
                                className={`flex-1 py-1 rounded-md text-[10px] uppercase font-black ${selectedElement.style.textAlign === align ? 'bg-white shadow-sm text-brand-primary' : 'text-gray-400'}`}
                              >
                                {align[0]}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <span className="text-[10px] text-gray-500 font-bold mb-1.5 block uppercase">Text Color</span>
                          <input 
                            type="color"
                            value={selectedElement.style.color || '#1f2937'}
                            onChange={(e) => updateStyle(selectedElement.id, { color: e.target.value })}
                            className="w-full h-8 bg-white border border-gray-200 rounded-lg p-1 cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] text-gray-500 font-bold mb-1.5 block">Primary Color</span>
                      <div className="flex gap-2">
                        {['#FF6B6B', '#4ECDC4', '#FFE66D', '#1e293b', '#ffffff'].map(c => (
                          <button
                            key={c}
                            onClick={() => updateStyle(selectedElement.id, { backgroundColor: c })}
                            className={`w-6 h-6 rounded-full border border-gray-200 ${selectedElement.style.backgroundColor === c ? 'ring-2 ring-gray-900 ring-offset-2' : ''}`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </section>

                <div className="h-px bg-gray-100" />

                {/* Interactions Section */}
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Interactions</label>
                    <button className="text-[10px] font-bold text-brand-primary hover:underline">+ New Block</button>
                  </div>
                  
                  <div className="space-y-2">
                    {selectedElement.interactions.length === 0 ? (
                      <div className="p-4 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-center">
                        <p className="text-[10px] text-gray-400 font-bold leading-tight">
                          Select an element on canvas to add triggers, animations, or level transitions.
                        </p>
                      </div>
                    ) : (
                      selectedElement.interactions.map((int, idx) => (
                        <div key={idx} className="p-3 bg-white border border-gray-100 rounded-xl shadow-sm space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-brand-primary uppercase flex items-center gap-1">
                              <Zap size={10} /> On {int.type}
                            </span>
                            <button className="text-gray-300 hover:text-red-500"><Trash2 size={12} /></button>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-gray-400">Action:</span>
                            <span className="text-[10px] font-bold text-gray-800 capitalize bg-gray-100 px-2 py-0.5 rounded-full">{int.action}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>

                <div className="h-px bg-gray-100" />

                {/* Pro Tips / Help */}
                <section className="bg-brand-primary/5 rounded-2xl p-4 border border-brand-primary/10">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-brand-primary/20 rounded-xl flex items-center justify-center text-brand-primary">
                      <HelpCircle size={18} />
                    </div>
                    <div>
                      <h4 className="text-[11px] font-black text-brand-primary uppercase mb-1">Pro Tip</h4>
                      <p className="text-[10px] text-gray-600 font-medium leading-relaxed">
                        Interactions are event-driven. You can link multiple events to a single component for complex gameplay.
                      </p>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          )}
        </aside>
      )}

      <input 
        type="file" 
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/*"
        className="hidden"
      />
    </div>
  </div>
  );
}
