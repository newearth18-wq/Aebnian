import type { SupabaseClient } from "@supabase/supabase-js";
import type { QuizPack, QuizQuestionRecord } from "../../shared/types";

type PackRow = { id: string; title: string; description: string | null; created_at: string; updated_at: string };
type QuestionRow = { id: string; prompt: string; options: string[]; correct_option: number; explanation: string | null; position: number };

export async function listPacks(client: SupabaseClient) {
  const { data, error } = await client.from("quiz_packs").select("id,title,description,created_at,updated_at,quiz_questions(id,prompt,options,correct_option,explanation,position)").order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: any) => fromRows(row as PackRow & { quiz_questions: QuestionRow[] }));
}

export async function savePack(client: SupabaseClient, pack: QuizPack) {
  const { data: userResult, error: userError } = await client.auth.getUser();
  if (userError || !userResult.user) throw new Error("กรุณาเข้าสู่ระบบครูก่อนบันทึกชุดคำถาม");
  const { data: header, error: headerError } = await client.from("quiz_packs").upsert({ id: pack.id || undefined, owner_id: userResult.user.id, title: pack.title.trim(), description: pack.description?.trim() || null }, { onConflict: "id" }).select("id,title,description,created_at,updated_at").single();
  if (headerError) throw headerError;
  const { error: deleteError } = await client.from("quiz_questions").delete().eq("pack_id", header.id);
  if (deleteError) throw deleteError;
  if (pack.questions.length) {
    const rows = pack.questions.map((question, index) => ({ pack_id: header.id, prompt: question.text.trim(), options: question.options, correct_option: question.correctOption, explanation: question.explanation, position: index }));
    const { error } = await client.from("quiz_questions").insert(rows);
    if (error) throw error;
  }
  return { ...pack, id: header.id, created_at: header.created_at, updated_at: header.updated_at };
}

export async function deletePack(client: SupabaseClient, id: string) {
  const { error } = await client.from("quiz_packs").delete().eq("id", id);
  if (error) throw error;
}

function fromRows(row: PackRow & { quiz_questions: QuestionRow[] }): QuizPack {
  const questions: QuizQuestionRecord[] = (row.quiz_questions ?? []).sort((a, b) => a.position - b.position).map((q) => ({ id: q.id, text: q.prompt, options: q.options, correctOption: q.correct_option, explanation: q.explanation, closesAt: 0 }));
  return { id: row.id, title: row.title, description: row.description, questions, created_at: row.created_at, updated_at: row.updated_at };
}
