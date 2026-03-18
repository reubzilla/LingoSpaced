import { Routes, Route, Link, useNavigate } from "react-router-dom";
import React, { useEffect, useState } from "react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Plus, Users, BookOpen, BarChart, Sparkles, Upload, Edit, Trash2, PlayCircle } from "lucide-react";
import { GoogleGenAI, Type } from "@google/genai";

export default function TeacherDashboard({ user }: { user: any }) {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">Teacher Dashboard</h2>
      </div>
      <Routes>
        <Route path="/" element={<ClassesList user={user} />} />
        <Route path="/class/:classId" element={<ClassDetails />} />
        <Route path="/class/:classId/set/:setId" element={<StudySetDetails />} />
      </Routes>
    </div>
  );
}

function ClassesList({ user }: { user: any }) {
  const [classes, setClasses] = useState<any[]>([]);
  const [newClassName, setNewClassName] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`/api/classes?teacher_id=${user.id}`)
      .then((res) => res.json())
      .then(setClasses);
  }, [user.id]);

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;
    const res = await fetch("/api/classes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newClassName, teacher_id: user.id }),
    });
    const newClass = await res.json();
    setClasses([...classes, newClass]);
    setNewClassName("");
  };

  return (
    <div className="grid gap-8 md:grid-cols-3">
      <div className="md:col-span-2 space-y-4">
        <h3 className="text-xl font-semibold">Your Classes</h3>
        {classes.length === 0 ? (
          <p className="text-slate-500">No classes yet. Create one to get started.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {classes.map((cls) => (
              <Card key={cls.id} className="hover:border-emerald-500 transition-colors cursor-pointer" onClick={() => navigate(`/teacher/class/${cls.id}`)}>
                <CardHeader>
                  <CardTitle className="text-lg">{cls.name}</CardTitle>
                  <CardDescription>Join Code: <span className="font-mono font-bold text-slate-900">{cls.join_code}</span></CardDescription>
                </CardHeader>
                <CardContent className="flex items-center text-sm text-slate-500 gap-4">
                  <div className="flex items-center gap-1"><Users className="w-4 h-4" /> Manage</div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
      <div>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Create New Class</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateClass} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="className">Class Name</Label>
                <Input
                  id="className"
                  placeholder="e.g. English 101"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full">
                <Plus className="w-4 h-4 mr-2" /> Create Class
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { useParams } from "react-router-dom";

function ClassDetails() {
  const { classId } = useParams();
  const [sets, setSets] = useState<any[]>([]);
  const [newSetTitle, setNewSetTitle] = useState("");
  const [newSetCefr, setNewSetCefr] = useState("");
  const [newSetTheme, setNewSetTheme] = useState("");
  const [analytics, setAnalytics] = useState<any>({ students: [], stats: [] });
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`/api/classes/${classId}/sets`)
      .then((res) => res.json())
      .then(setSets);
    
    fetch(`/api/analytics/class/${classId}`)
      .then((res) => res.json())
      .then(setAnalytics);
  }, [classId]);

  const sortedStudents = React.useMemo(() => {
    if (!sortConfig) return analytics.students;
    
    return [...analytics.students].sort((a: any, b: any) => {
      const statA = analytics.stats.find((s: any) => s.student_id === a.id);
      const statB = analytics.stats.find((s: any) => s.student_id === b.id);
      const timeStatA = analytics.timeStats?.find((s: any) => s.student_id === a.id);
      const timeStatB = analytics.timeStats?.find((s: any) => s.student_id === b.id);

      let valA, valB;

      switch (sortConfig.key) {
        case "name": valA = a.name; valB = b.name; break;
        case "points": valA = a.points; valB = b.points; break;
        case "streak": valA = a.streak; valB = b.streak; break;
        case "cards_studied": valA = statA ? statA.cards_studied : 0; valB = statB ? statB.cards_studied : 0; break;
        case "mastered": valA = statA ? statA.mastered_count : 0; valB = statB ? statB.mastered_count : 0; break;
        case "struggling": valA = statA ? statA.struggling_count : 0; valB = statB ? statB.struggling_count : 0; break;
        case "avg_ease": valA = statA ? statA.avg_ease : 0; valB = statB ? statB.avg_ease : 0; break;
        case "time_spent": valA = timeStatA ? timeStatA.total_time_seconds : 0; valB = timeStatB ? timeStatB.total_time_seconds : 0; break;
        default: return 0;
      }

      if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
      if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [analytics, sortConfig]);

  const requestSort = (key: string) => {
    let direction: "asc" | "desc" = "desc";
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "desc") {
      direction = "asc";
    }
    setSortConfig({ key, direction });
  };

  const handleCreateSet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSetTitle.trim()) return;
    const res = await fetch(`/api/classes/${classId}/sets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newSetTitle, cefr_level: newSetCefr, theme: newSetTheme }),
    });
    const newSet = await res.json();
    setSets([...sets, newSet]);
    setNewSetTitle("");
    setNewSetCefr("");
    setNewSetTheme("");
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => navigate("/teacher")}>&larr; Back</Button>
        <h3 className="text-2xl font-bold">Class Details</h3>
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        <div className="space-y-4 md:col-span-1">
          <h4 className="text-xl font-semibold flex items-center gap-2"><BookOpen className="w-5 h-5 text-emerald-600" /> Study Sets</h4>
          <Card>
            <CardContent className="p-4 space-y-4">
              <form onSubmit={handleCreateSet} className="grid gap-2">
                <Input
                  placeholder="New study set title..."
                  value={newSetTitle}
                  onChange={(e) => setNewSetTitle(e.target.value)}
                />
                <div className="flex gap-2">
                  <select
                    className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                    value={newSetCefr}
                    onChange={(e) => setNewSetCefr(e.target.value)}
                  >
                    <option value="">CEFR Level (Optional)</option>
                    <option value="A1">A1 (Beginner)</option>
                    <option value="A2">A2 (Elementary)</option>
                    <option value="B1">B1 (Intermediate)</option>
                    <option value="B2">B2 (Upper Intermediate)</option>
                    <option value="C1">C1 (Advanced)</option>
                    <option value="C2">C2 (Proficient)</option>
                  </select>
                  <Input
                    placeholder="Theme (e.g. Travel)"
                    value={newSetTheme}
                    onChange={(e) => setNewSetTheme(e.target.value)}
                  />
                </div>
                <Button type="submit">Add Set</Button>
              </form>
              <div className="space-y-2">
                {sets.map((set) => (
                  <div key={set.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100 hover:border-emerald-200 transition-colors cursor-pointer" onClick={() => navigate(`/teacher/class/${classId}/set/${set.id}`)}>
                    <div>
                      <span className="font-medium block">{set.title}</span>
                      <span className="text-xs text-slate-500">
                        {set.cefr_level && `CEFR: ${set.cefr_level} `}
                        {set.theme && `Theme: ${set.theme}`}
                      </span>
                    </div>
                    <Button variant="ghost" size="sm">Edit Cards &rarr;</Button>
                  </div>
                ))}
                {sets.length === 0 && <p className="text-sm text-slate-500 text-center py-4">No study sets yet.</p>}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 md:col-span-2">
          <h4 className="text-xl font-semibold flex items-center gap-2"><BarChart className="w-5 h-5 text-emerald-600" /> Student Progress</h4>
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-3 cursor-pointer hover:bg-slate-100" onClick={() => requestSort("name")}>Student</th>
                    <th className="px-6 py-3 cursor-pointer hover:bg-slate-100" onClick={() => requestSort("points")}>Points</th>
                    <th className="px-6 py-3 cursor-pointer hover:bg-slate-100" onClick={() => requestSort("streak")}>Streak</th>
                    <th className="px-6 py-3 cursor-pointer hover:bg-slate-100" onClick={() => requestSort("cards_studied")}>Cards Studied</th>
                    <th className="px-6 py-3 cursor-pointer hover:bg-slate-100" onClick={() => requestSort("mastered")}>Mastered</th>
                    <th className="px-6 py-3 cursor-pointer hover:bg-slate-100" onClick={() => requestSort("struggling")}>Struggling</th>
                    <th className="px-6 py-3 cursor-pointer hover:bg-slate-100" onClick={() => requestSort("avg_ease")}>Avg Ease</th>
                    <th className="px-6 py-3 cursor-pointer hover:bg-slate-100" onClick={() => requestSort("time_spent")}>Time Spent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedStudents.map((student: any) => {
                    const stat = analytics.stats.find((s: any) => s.student_id === student.id);
                    const timeStat = analytics.timeStats?.find((s: any) => s.student_id === student.id);
                    return (
                      <tr key={student.id} className="bg-white hover:bg-slate-50">
                        <td className="px-6 py-4 font-medium text-slate-900">{student.name}</td>
                        <td className="px-6 py-4">{student.points}</td>
                        <td className="px-6 py-4">{student.streak} days</td>
                        <td className="px-6 py-4">{stat ? stat.cards_studied : 0}</td>
                        <td className="px-6 py-4 text-emerald-600 font-medium">{stat ? stat.mastered_count : 0}</td>
                        <td className="px-6 py-4 text-red-500 font-medium">{stat ? stat.struggling_count : 0}</td>
                        <td className="px-6 py-4">{stat ? stat.avg_ease.toFixed(1) : '-'}</td>
                        <td className="px-6 py-4">{timeStat ? Math.round(timeStat.total_time_seconds / 60) : 0} min</td>
                      </tr>
                    );
                  })}
                  {analytics.students.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-6 py-8 text-center text-slate-500">No students have joined this class yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StudySetDetails() {
  const { classId, setId } = useParams();
  const [setDetails, setSetDetails] = useState<any>(null);
  const [cards, setCards] = useState<any[]>([]);
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [extra, setExtra] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [batchWords, setBatchWords] = useState("");
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const [editingCardId, setEditingCardId] = useState<number | null>(null);
  const navigate = useNavigate();

  const loadCards = () => {
    fetch(`/api/sets/${setId}/cards`)
      .then((res) => res.json())
      .then(setCards);
  };

  useEffect(() => {
    fetch(`/api/sets/${setId}`)
      .then((res) => res.json())
      .then(setSetDetails);

    loadCards();
  }, [setId]);

  const handleGenerateAI = async () => {
    if (!front.trim()) {
      alert("Please enter a word or phrase in the 'Front' field first.");
      return;
    }
    
    setIsGenerating(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      // Generate text content
      const prompt = `Generate a definition and an example sentence for the word/phrase: "${front}".
      ${setDetails?.cefr_level ? `The target audience is ESL students at the ${setDetails.cefr_level} CEFR level.` : ''}
      ${setDetails?.theme ? `The context/theme is: ${setDetails.theme}.` : ''}
      The definition should be simple and easy to understand.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              definition: { type: Type.STRING },
              exampleSentence: { type: Type.STRING }
            },
            required: ["definition", "exampleSentence"]
          }
        }
      });

      const result = JSON.parse(response.text || "{}");
      if (result.definition) setBack(result.definition);
      if (result.exampleSentence) setExtra(result.exampleSentence);

      // Generate image
      const imagePrompt = `A simple, clear illustration of the concept: "${front}". ${setDetails?.theme ? `Theme: ${setDetails.theme}.` : ''} Suitable for an educational flashcard. No text in the image.`;
      const imageResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: imagePrompt,
      });

      for (const part of imageResponse.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          const base64EncodeString = part.inlineData.data;
          const imageUrl = `data:${part.inlineData.mimeType};base64,${base64EncodeString}`;
          
          // Convert base64 to File object to put in state
          const res = await fetch(imageUrl);
          const blob = await res.blob();
          const file = new File([blob], "generated-image.png", { type: part.inlineData.mimeType });
          setImageFile(file);
          break;
        }
      }

    } catch (error) {
      console.error("Error generating content:", error);
      alert("Failed to generate content. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!front.trim() || !back.trim()) return;

    let image_url = "";
    let audio_url = "";

    if (imageFile) {
      const reader = new FileReader();
      image_url = await new Promise((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(imageFile);
      });
    }

    if (audioFile) {
      const reader = new FileReader();
      audio_url = await new Promise((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(audioFile);
      });
    }

    if (editingCardId) {
      await fetch(`/api/cards/${editingCardId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ front, back, extra, image_url: image_url || cards.find(c => c.id === editingCardId)?.image_url, audio_url: audio_url || cards.find(c => c.id === editingCardId)?.audio_url }),
      });
      setEditingCardId(null);
    } else {
      await fetch(`/api/sets/${setId}/cards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ front, back, extra, image_url, audio_url }),
      });
    }
    
    loadCards();
    setFront("");
    setBack("");
    setExtra("");
    setImageFile(null);
    setAudioFile(null);
  };

  const handleEditCard = (card: any) => {
    setEditingCardId(card.id);
    setFront(card.front);
    setBack(card.back);
    setExtra(card.extra || "");
    setImageFile(null);
    setAudioFile(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteCard = async (cardId: number) => {
    if (!confirm("Are you sure you want to delete this card?")) return;
    await fetch(`/api/cards/${cardId}`, { method: "DELETE" });
    loadCards();
  };

  const handleBatchGenerate = async () => {
    if (!batchWords.trim()) {
      alert("Please enter a list of words.");
      return;
    }

    setIsBatchGenerating(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const words = batchWords.split(/[\n,]+/).map(w => w.trim()).filter(w => w.length > 0);
      
      const prompt = `Generate a JSON array of flashcards for the following words: ${words.join(", ")}.
      ${setDetails?.cefr_level ? `Target audience: ESL students at ${setDetails.cefr_level} CEFR level.` : ''}
      ${setDetails?.theme ? `Theme: ${setDetails.theme}.` : ''}
      Each object in the array MUST have exactly these properties:
      - "front": the word/phrase
      - "back": a simple definition
      - "extra": an example sentence`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                front: { type: Type.STRING },
                back: { type: Type.STRING },
                extra: { type: Type.STRING }
              },
              required: ["front", "back", "extra"]
            }
          }
        }
      });

      const generatedCards = JSON.parse(response.text || "[]");
      
      // We skip image generation for batch to avoid rate limits/long wait times, 
      // but they can be added individually later.
      
      await fetch(`/api/sets/${setId}/cards/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cards: generatedCards }),
      });

      loadCards();
      setBatchWords("");
      alert(`Successfully generated ${generatedCards.length} cards!`);
    } catch (error) {
      console.error("Batch generation error:", error);
      alert("Failed to generate batch cards. Please try again.");
    } finally {
      setIsBatchGenerating(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => navigate(`/teacher/class/${classId}`)}>&larr; Back</Button>
        <h3 className="text-2xl font-bold">Edit Flashcards</h3>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{editingCardId ? "Edit Card" : "Add New Card"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddCard} className="grid gap-4 md:grid-cols-3 items-end">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>Front (Word/Phrase)</Label>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={handleGenerateAI}
                  disabled={isGenerating || !front.trim()}
                  className="h-7 text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                >
                  <Sparkles className="w-3 h-3 mr-1" />
                  {isGenerating ? "Generating..." : "Generate with AI"}
                </Button>
              </div>
              <Input value={front} onChange={(e) => setFront(e.target.value)} placeholder="e.g. Apple" />
            </div>
            <div className="space-y-2">
              <Label>Back (Translation/Meaning)</Label>
              <Input value={back} onChange={(e) => setBack(e.target.value)} placeholder="e.g. Manzana" />
            </div>
            <div className="space-y-2">
              <Label>Extra (Example Sentence)</Label>
              <Input value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="e.g. I ate an apple." />
            </div>
            <div className="space-y-2">
              <Label>Image (Optional)</Label>
              <div className="flex gap-2 items-center">
                <Input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
                {imageFile && <span className="text-xs text-emerald-600 font-medium whitespace-nowrap">File selected</span>}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Audio (Optional)</Label>
              <Input type="file" accept="audio/*" onChange={(e) => setAudioFile(e.target.files?.[0] || null)} />
            </div>
            <div className="flex gap-2 md:col-span-3">
              <Button type="submit" className="flex-1">{editingCardId ? "Save Changes" : "Add Card"}</Button>
              {editingCardId && (
                <Button type="button" variant="outline" onClick={() => {
                  setEditingCardId(null);
                  setFront(""); setBack(""); setExtra(""); setImageFile(null); setAudioFile(null);
                }}>Cancel</Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Batch Import with AI</CardTitle>
          <CardDescription>Enter a list of words (comma or newline separated) to automatically generate cards.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <textarea
            className="w-full min-h-[100px] p-3 rounded-xl border border-slate-200 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            placeholder="apple, banana, orange&#10;or&#10;apple&#10;banana&#10;orange"
            value={batchWords}
            onChange={(e) => setBatchWords(e.target.value)}
          />
          <Button 
            onClick={handleBatchGenerate} 
            disabled={isBatchGenerating || !batchWords.trim()}
            className="w-full"
          >
            {isBatchGenerating ? "Generating Cards..." : "Generate Batch Cards"}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h4 className="text-xl font-semibold">Cards in this set ({cards.length})</h4>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <Card key={card.id} className="bg-white flex flex-col">
              {card.image_url && (
                <div className="w-full h-32 bg-slate-100 rounded-t-2xl overflow-hidden border-b border-slate-100">
                  <img src={card.image_url} alt={card.front} className="w-full h-full object-contain p-2" />
                </div>
              )}
              <CardContent className="p-4 space-y-2 flex-1 flex flex-col">
                <div className="flex justify-between items-start">
                  <p className="font-bold text-lg flex items-center gap-2">
                    {card.front}
                    {card.audio_url && <PlayCircle className="w-4 h-4 text-emerald-600" />}
                  </p>
                  <div className="flex gap-1">
                    <button onClick={() => handleEditCard(card)} className="p-1 text-slate-400 hover:text-emerald-600 transition-colors"><Edit className="w-4 h-4" /></button>
                    <button onClick={() => handleDeleteCard(card.id)} className="p-1 text-slate-400 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
                <p className="text-slate-600 flex-1">{card.back}</p>
                {card.extra && <p className="text-sm text-slate-400 italic mt-2 border-t border-slate-100 pt-2">{card.extra}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
