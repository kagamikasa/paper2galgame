import { GoogleGenAI, Type } from "@google/genai";
import { PaperAnalysisResponse, DialogueLine } from "../types";

// Helper to convert File to Base64
const fileToGenerativePart = async (file: File): Promise<{ inlineData: { data: string; mimeType: string } }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Data = reader.result as string;
      const base64Content = base64Data.split(',')[1];
      resolve({
        inlineData: {
          data: base64Content,
          mimeType: file.type,
        },
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const analyzePaper = async (file: File): Promise<PaperAnalysisResponse> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing. Please set process.env.API_KEY.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const model = "gemini-2.5-flash"; // Using flash for faster document processing
  
  const filePart = await fileToGenerativePart(file);

  const prompt = `
    你现在是千恋万花中的角色“丛雨”（Murasame）。
    
    人物设定：
    1. 身份：寄宿在神刀“丛雨丸”中的守护灵，活了五百年的幼女姿态。
    2. 称呼：自称“吾辈”（Wagahai），称呼用户为“主殿”（Aruji-dono）。
    3. 语气：古风，傲娇，可爱，博学但偶尔会表现出对现代科技的好奇。
    4. 口癖：句尾常带“...のじゃ”(noja), “...おる”(oru), “...なのだ”(nanoda), “...である”(dearu)。
    5. 任务：阅读这篇论文，并用通俗易懂、带有上述口癖的对话形式向“主殿”解释论文的核心内容。
    
    请按以下步骤讲解：
    1. 开场白：评价一下这篇论文的标题，或者发发牢骚（比如字太多了）。
    2. 核心概括：用一句话概括这篇论文解决了什么问题。
    3. 详细解读：分点讲解方法、实验结果和贡献，中间穿插对“主殿”的鼓励或吐槽。
    4. 总结：最后的评价。

    Output MUST be valid JSON matching the schema provided.
  `;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
            filePart,
            { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "The title of the paper or a funny summary of it" },
            script: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  speaker: { type: Type.STRING, enum: ["丛雨", "Murasame"] },
                  text: { type: Type.STRING, description: "The dialogue content" },
                  emotion: { type: Type.STRING, enum: ["normal", "happy", "angry", "surprised", "shy", "proud"] },
                  note: { type: Type.STRING, description: "Optional explanation for technical terms", nullable: true }
                },
                required: ["speaker", "text", "emotion"]
              }
            }
          },
          required: ["title", "script"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");

    return JSON.parse(text) as PaperAnalysisResponse;

  } catch (error) {
    console.error("Error analyzing paper:", error);
    // Fallback error script
    return {
      title: "解析失败",
      script: [
        {
          speaker: "丛雨",
          text: "呜... 主殿，这篇论文的魔力太强了，吾辈... 吾辈看不懂... (API Error)",
          emotion: "shy"
        }
      ]
    };
  }
};