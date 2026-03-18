import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, CheckCircle2, XCircle, RotateCcw, BrainCircuit, Keyboard, ListOrdered, Edit3, PlayCircle } from "lucide-react";

type StudyMode = "flashcards" | "gap-fill" | "spelling" | "word-order";

export default function StudySession({ user }: { user: any }) {
  const { setId } = useParams();
  const navigate = useNavigate();
  const [cards, setCards] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mode, setMode] = useState<StudyMode>("flashcards");
  const [isFlipped, setIsFlipped] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [feedback, setFeedback] = useState<"correct" | "incorrect" | null>(null);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [earnedPoints, setEarnedPoints] = useState(0);
  const [wordOrderItems, setWordOrderItems] = useState<{ id: string; text: string }[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<{ id: string; text: string }[]>([]);

  useEffect(() => {
    fetch(`/api/study/${user.id}/${setId}`)
      .then((res) => res.json())
      .then((data) => {
        // Sort by next_review_date (oldest first) or random if null
        const sorted = data.sort((a: any, b: any) => {
          if (!a.next_review_date) return -1;
          if (!b.next_review_date) return 1;
          return new Date(a.next_review_date).getTime() - new Date(b.next_review_date).getTime();
        });
        setCards(sorted);
        if (sorted.length > 0) {
          fetch("/api/study/session/start", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ student_id: user.id, set_id: setId }),
          })
            .then((res) => res.json())
            .then((data) => setSessionId(data.session_id));
        }
      });
  }, [user.id, setId]);

  useEffect(() => {
    if (mode === "word-order" && cards[currentIndex]) {
      const card = cards[currentIndex];
      const sentence = card.extra || card.front;
      const words = sentence.split(" ").map((w: string, i: number) => ({ id: `${i}`, text: w }));
      setWordOrderItems(words.sort(() => Math.random() - 0.5));
      setSelectedOrder([]);
    }
  }, [currentIndex, mode, cards]);

  const handleProgress = async (quality: number) => {
    const card = cards[currentIndex];
    const res = await fetch("/api/study/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: user.id, card_id: card.id, quality }),
    });
    const data = await res.json();
    if (data.pointsEarned) {
      setEarnedPoints((prev) => prev + data.pointsEarned);
    }
    nextCard();
  };

  const nextCard = () => {
    setIsFlipped(false);
    setInputValue("");
    setFeedback(null);
    if (currentIndex < cards.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      if (sessionId) {
        fetch("/api/study/session/end", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId }),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.pointsEarned) setEarnedPoints((prev) => prev + data.pointsEarned);
            setSessionComplete(true);
          });
      } else {
        setSessionComplete(true);
      }
    }
  };

  const checkAnswer = () => {
    const card = cards[currentIndex];
    let isCorrect = false;

    if (mode === "spelling") {
      isCorrect = inputValue.toLowerCase().trim() === card.front.toLowerCase().trim();
    } else if (mode === "gap-fill") {
      isCorrect = inputValue.toLowerCase().trim() === card.front.toLowerCase().trim();
    } else if (mode === "word-order") {
      const target = (card.extra || card.front).split(" ").join(" ");
      const current = selectedOrder.map((o) => o.text).join(" ");
      isCorrect = target === current;
    }

    if (isCorrect) {
      setFeedback("correct");
      setTimeout(() => handleProgress(5), 1000); // Perfect score
    } else {
      setFeedback("incorrect");
      setTimeout(() => {
        setFeedback(null);
        if (mode === "word-order") {
          setSelectedOrder([]);
        } else {
          setInputValue("");
        }
      }, 1500);
    }
  };

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <p className="text-slate-500">Loading or no cards available...</p>
        <Button variant="outline" onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

  if (sessionComplete) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
        <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
          <CheckCircle2 className="w-12 h-12" />
        </div>
        <h2 className="text-3xl font-bold text-slate-900">Session Complete!</h2>
        <p className="text-slate-500 text-lg">Great job reviewing {cards.length} cards.</p>
        <p className="text-emerald-600 font-bold text-xl">+{earnedPoints} Points Earned!</p>
        <div className="flex gap-4">
          <Button onClick={() => { setCurrentIndex(0); setSessionComplete(false); }}>Review Again</Button>
          <Button variant="outline" onClick={() => navigate(-1)}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  const card = cards[currentIndex];

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate(-1)} className="text-slate-500">
          <ArrowLeft className="w-4 h-4 mr-2" /> Exit
        </Button>
        <div className="text-sm font-medium text-slate-500">
          Card {currentIndex + 1} of {cards.length}
        </div>
      </div>

      <div className="flex justify-center gap-2 mb-8 bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
        <ModeButton active={mode === "flashcards"} onClick={() => setMode("flashcards")} icon={<BrainCircuit className="w-4 h-4" />} label="Flashcards" />
        <ModeButton active={mode === "gap-fill"} onClick={() => setMode("gap-fill")} icon={<Edit3 className="w-4 h-4" />} label="Gap Fill" />
        <ModeButton active={mode === "spelling"} onClick={() => setMode("spelling")} icon={<Keyboard className="w-4 h-4" />} label="Spelling" />
        <ModeButton active={mode === "word-order"} onClick={() => setMode("word-order")} icon={<ListOrdered className="w-4 h-4" />} label="Word Order" />
      </div>

      <div className="min-h-[400px] flex flex-col items-center justify-center relative">
        {card.audio_url && (
          <audio id={`audio-${card.id}`} src={card.audio_url} preload="auto" />
        )}
        <AnimatePresence mode="wait">
          {mode === "flashcards" && (
            <motion.div
              key={`flashcard-${currentIndex}-${isFlipped}`}
              initial={{ rotateY: 90, opacity: 0 }}
              animate={{ rotateY: 0, opacity: 1 }}
              exit={{ rotateY: -90, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-xl aspect-[3/2] cursor-pointer perspective-1000"
              onClick={() => setIsFlipped(!isFlipped)}
            >
              <Card className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-white shadow-md hover:shadow-lg transition-shadow border-2 border-slate-100">
                {!isFlipped ? (
                  <div className="space-y-4">
                    <span className="text-sm font-medium text-emerald-600 uppercase tracking-widest">Front</span>
                    {card.image_url && (
                      <img src={card.image_url} alt="Flashcard" className="max-h-32 object-contain mx-auto rounded-lg mb-4" />
                    )}
                    <h3 className="text-4xl font-bold text-slate-900 flex items-center justify-center gap-2">
                      {card.front}
                      {card.audio_url && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); (document.getElementById(`audio-${card.id}`) as HTMLAudioElement)?.play(); }}
                          className="p-2 rounded-full hover:bg-slate-100 text-slate-500"
                        >
                          <PlayCircle className="w-6 h-6" />
                        </button>
                      )}
                    </h3>
                    <p className="text-sm text-slate-400 mt-8">Click to flip</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <span className="text-sm font-medium text-emerald-600 uppercase tracking-widest">Back</span>
                    <h3 className="text-3xl font-semibold text-slate-800">{card.back}</h3>
                    {card.extra && (
                      <div className="pt-4 border-t border-slate-100 w-full">
                        <p className="text-lg text-slate-600 italic">"{card.extra}"</p>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            </motion.div>
          )}

          {mode === "gap-fill" && (
            <motion.div
              key={`gapfill-${currentIndex}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-xl"
            >
              <Card className="p-8 space-y-8 text-center bg-white shadow-md border-2 border-slate-100">
                <div className="space-y-2">
                  <span className="text-sm font-medium text-emerald-600 uppercase tracking-widest">Meaning</span>
                  <p className="text-2xl font-medium text-slate-700">{card.back}</p>
                </div>
                {card.extra ? (
                  <div className="text-xl text-slate-800 leading-relaxed">
                    {card.extra.split(new RegExp(`(${card.front})`, "i")).map((part: string, i: number) =>
                      part.toLowerCase() === card.front.toLowerCase() ? (
                        <span key={i} className="inline-block mx-2 border-b-2 border-slate-300 w-24">
                          <Input
                            autoFocus
                            className="text-center text-xl h-8 border-none shadow-none focus-visible:ring-0 px-0 rounded-none bg-transparent"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && checkAnswer()}
                          />
                        </span>
                      ) : (
                        <span key={i}>{part}</span>
                      )
                    )}
                  </div>
                ) : (
                  <div className="max-w-xs mx-auto">
                    <Input
                      autoFocus
                      placeholder="Type the word..."
                      className="text-center text-xl h-12"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && checkAnswer()}
                    />
                  </div>
                )}
                <div className="flex justify-center h-10">
                  {feedback === "correct" && <p className="text-emerald-600 font-medium flex items-center gap-2"><CheckCircle2 className="w-5 h-5" /> Correct!</p>}
                  {feedback === "incorrect" && <p className="text-red-500 font-medium flex items-center gap-2"><XCircle className="w-5 h-5" /> Try again</p>}
                </div>
                <Button className="w-full" onClick={checkAnswer} disabled={!inputValue}>Check Answer</Button>
              </Card>
            </motion.div>
          )}

          {mode === "spelling" && (
            <motion.div
              key={`spelling-${currentIndex}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-xl"
            >
              <Card className="p-8 space-y-8 text-center bg-white shadow-md border-2 border-slate-100">
                <div className="space-y-2">
                  <span className="text-sm font-medium text-emerald-600 uppercase tracking-widest">Translate to English</span>
                  <p className="text-3xl font-bold text-slate-800">{card.back}</p>
                </div>
                <div className="max-w-sm mx-auto">
                  <Input
                    autoFocus
                    placeholder="Type the English word..."
                    className="text-center text-xl h-14 rounded-2xl"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && checkAnswer()}
                  />
                </div>
                <div className="flex justify-center h-10">
                  {feedback === "correct" && <p className="text-emerald-600 font-medium flex items-center gap-2"><CheckCircle2 className="w-5 h-5" /> Correct!</p>}
                  {feedback === "incorrect" && <p className="text-red-500 font-medium flex items-center gap-2"><XCircle className="w-5 h-5" /> Incorrect</p>}
                </div>
                <Button className="w-full h-12 text-lg rounded-xl" onClick={checkAnswer} disabled={!inputValue}>Check Spelling</Button>
              </Card>
            </motion.div>
          )}

          {mode === "word-order" && (
            <motion.div
              key={`wordorder-${currentIndex}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-2xl"
            >
              <Card className="p-8 space-y-8 bg-white shadow-md border-2 border-slate-100">
                <div className="text-center space-y-2">
                  <span className="text-sm font-medium text-emerald-600 uppercase tracking-widest">Construct the Sentence</span>
                  <p className="text-xl text-slate-600">{card.back}</p>
                </div>
                
                <div className="min-h-[80px] p-4 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-wrap gap-2 items-center justify-center">
                  {selectedOrder.map((item, i) => (
                    <motion.button
                      layoutId={`word-${item.id}`}
                      key={item.id}
                      onClick={() => {
                        setSelectedOrder(selectedOrder.filter((o) => o.id !== item.id));
                        setWordOrderItems([...wordOrderItems, item]);
                      }}
                      className="px-4 py-2 bg-white border border-slate-200 rounded-lg shadow-sm text-lg font-medium hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors"
                    >
                      {item.text}
                    </motion.button>
                  ))}
                  {selectedOrder.length === 0 && <span className="text-slate-400">Select words below...</span>}
                </div>

                <div className="flex flex-wrap gap-3 justify-center">
                  {wordOrderItems.map((item) => (
                    <motion.button
                      layoutId={`word-${item.id}`}
                      key={item.id}
                      onClick={() => {
                        setWordOrderItems(wordOrderItems.filter((w) => w.id !== item.id));
                        setSelectedOrder([...selectedOrder, item]);
                      }}
                      className="px-4 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg shadow-sm text-lg font-medium hover:bg-emerald-100 transition-colors"
                    >
                      {item.text}
                    </motion.button>
                  ))}
                </div>

                <div className="flex justify-center h-10">
                  {feedback === "correct" && <p className="text-emerald-600 font-medium flex items-center gap-2"><CheckCircle2 className="w-5 h-5" /> Correct!</p>}
                  {feedback === "incorrect" && <p className="text-red-500 font-medium flex items-center gap-2"><XCircle className="w-5 h-5" /> Try again</p>}
                </div>

                <div className="flex gap-4">
                  <Button 
                    variant="outline" 
                    className="flex-1 h-12"
                    onClick={() => {
                      setWordOrderItems([...wordOrderItems, ...selectedOrder].sort(() => Math.random() - 0.5));
                      setSelectedOrder([]);
                    }}
                  >
                    <RotateCcw className="w-4 h-4 mr-2" /> Reset
                  </Button>
                  <Button 
                    className="flex-1 h-12" 
                    onClick={checkAnswer} 
                    disabled={selectedOrder.length === 0}
                  >
                    Check Order
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {mode === "flashcards" && isFlipped && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center space-y-4"
        >
          <p className="text-sm font-medium text-slate-500 uppercase tracking-widest">How well did you know this?</p>
          <div className="flex gap-2 w-full max-w-xl">
            <Button variant="destructive" className="flex-1 h-14 text-lg" onClick={() => handleProgress(1)}>Again</Button>
            <Button variant="outline" className="flex-1 h-14 text-lg border-orange-200 hover:bg-orange-50 hover:text-orange-700" onClick={() => handleProgress(3)}>Hard</Button>
            <Button variant="outline" className="flex-1 h-14 text-lg border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700" onClick={() => handleProgress(4)}>Good</Button>
            <Button className="flex-1 h-14 text-lg bg-emerald-600 hover:bg-emerald-700" onClick={() => handleProgress(5)}>Easy</Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function ModeButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
        active 
          ? "bg-emerald-100 text-emerald-700 shadow-sm" 
          : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
