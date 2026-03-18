import { Routes, Route, Link, useNavigate } from "react-router-dom";
import React, { useEffect, useState } from "react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { BookOpen, LogIn, PlayCircle, Trophy, Flame, Medal } from "lucide-react";

export default function StudentDashboard({ user }: { user: any }) {
  const [badges, setBadges] = useState<any[]>([]);

  useEffect(() => {
    fetch(`/api/users/${user.id}/badges`)
      .then((res) => res.json())
      .then(setBadges);
  }, [user.id]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">Student Dashboard</h2>
        <div className="flex items-center gap-6 bg-white px-6 py-3 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            <span className="font-bold text-lg">{user.points} pts</span>
          </div>
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-500" />
            <span className="font-bold text-lg">{user.streak} days</span>
          </div>
        </div>
      </div>
      
      {badges.length > 0 && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {badges.map((badge) => (
            <div key={badge.id} className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-full border border-emerald-200 whitespace-nowrap">
              <Medal className="w-4 h-4" />
              <span className="font-medium text-sm">{badge.badge_name}</span>
            </div>
          ))}
        </div>
      )}

      <Routes>
        <Route path="/" element={<JoinedClasses user={user} />} />
        <Route path="/class/:classId" element={<ClassStudySets user={user} />} />
      </Routes>
    </div>
  );
}

function JoinedClasses({ user }: { user: any }) {
  const [classes, setClasses] = useState<any[]>([]);
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [leaderboards, setLeaderboards] = useState<Record<number, any[]>>({});
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`/api/classes?student_id=${user.id}`)
      .then((res) => res.json())
      .then((data) => {
        setClasses(data);
        data.forEach((cls: any) => {
          fetch(`/api/classes/${cls.id}/leaderboard`)
            .then((res) => res.json())
            .then((lb) => setLeaderboards((prev) => ({ ...prev, [cls.id]: lb })));
        });
      });
  }, [user.id]);

  const handleJoinClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!joinCode.trim()) return;
    const res = await fetch("/api/classes/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ join_code: joinCode, student_id: user.id }),
    });
    if (res.ok) {
      const data = await res.json();
      setClasses([...classes, data.class]);
      setJoinCode("");
    } else {
      const err = await res.json();
      setError(err.error || "Failed to join class");
    }
  };

  return (
    <div className="grid gap-8 md:grid-cols-3">
      <div className="md:col-span-2 space-y-4">
        <h3 className="text-xl font-semibold">Your Classes</h3>
        {classes.length === 0 ? (
          <p className="text-slate-500">You haven't joined any classes yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {classes.map((cls) => (
              <Card key={cls.id} className="hover:border-emerald-500 transition-colors cursor-pointer" onClick={() => navigate(`/student/class/${cls.id}`)}>
                <CardHeader>
                  <CardTitle className="text-lg">{cls.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center text-sm text-emerald-600 font-medium gap-2">
                    <BookOpen className="w-4 h-4" /> View Study Sets &rarr;
                  </div>
                  {leaderboards[cls.id] && (
                    <div className="pt-4 border-t border-slate-100">
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Leaderboard</h4>
                      <div className="space-y-2">
                        {leaderboards[cls.id].slice(0, 3).map((lbUser: any, idx: number) => (
                          <div key={lbUser.id} className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-2">
                              <span className="text-slate-400 font-mono">{idx + 1}.</span>
                              <span className={lbUser.id === user.id ? "font-bold text-emerald-600" : ""}>{lbUser.name}</span>
                            </span>
                            <span className="font-medium text-slate-600">{lbUser.points} pts</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
      <div>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Join a Class</CardTitle>
            <CardDescription>Enter the code provided by your teacher.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleJoinClass} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="joinCode">Class Code</Label>
                <Input
                  id="joinCode"
                  placeholder="e.g. A1B2C3"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button type="submit" className="w-full">
                <LogIn className="w-4 h-4 mr-2" /> Join Class
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { useParams } from "react-router-dom";

function ClassStudySets({ user }: { user: any }) {
  const { classId } = useParams();
  const [sets, setSets] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`/api/classes/${classId}/sets`)
      .then((res) => res.json())
      .then(setSets);
  }, [classId]);

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => navigate("/student")}>&larr; Back</Button>
        <h3 className="text-2xl font-bold">Study Sets</h3>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sets.map((set) => (
          <Card key={set.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="text-xl">{set.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <Button className="w-full" onClick={() => navigate(`/study/${set.id}`)}>
                <PlayCircle className="w-4 h-4 mr-2" /> Start Studying
              </Button>
            </CardContent>
          </Card>
        ))}
        {sets.length === 0 && <p className="text-slate-500 col-span-full">Your teacher hasn't added any study sets yet.</p>}
      </div>
    </div>
  );
}
