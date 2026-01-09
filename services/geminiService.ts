import { GoogleGenAI, Type } from "@google/genai";
import { PaperAnalysisResponse, DialogueLine, GameSettings } from "../types";

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

export const analyzePaper = async (file: File, settings: GameSettings): Promise<PaperAnalysisResponse> => {
  
  // =========================================================================================
  // API KEY CONFIGURATION / API Key 配置
  // 
  // [Current Status]: Using Hardcoded Gemini Key provided by user.
  // [当前状态]: 使用用户提供的硬编码 Gemini Key。
  //
  // [How to change to DeepSeek / OpenAI / Other APIs]:
  // The current code uses the `@google/genai` SDK which ONLY works with Google Gemini models.
  // If you want to use DeepSeek (which is OpenAI-compatible), you CANNOT use this SDK.
  //
  // You must rewrite this function to use standard `fetch` or the `openai` library:
  // 
  // const response = await fetch("https://api.deepseek.com/chat/completions", {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json", "Authorization": "Bearer YOUR_DEEPSEEK_KEY" },
  //   body: JSON.stringify({ ... })
  // });
  //
  // =========================================================================================
  
  // Replace this string if you want to use a different Gemini Key
  const API_KEY = "AIzaSyCPVlvIzjkm0VyDPyCGaZoMo3oa8zTSZAc"; 

  const ai = new GoogleGenAI({ apiKey: API_KEY });
  
  const model = "gemini-2.5-flash"; 
  
  const filePart = await fileToGenerativePart(file);

  // Customize prompt based on settings
  const detailInstruction = settings.detailLevel === 'detailed' 
    ? "讲解要极其细致，对话回合数至少要25轮以上。不要略过任何技术细节，尤其是方法论和实验部分。" 
    : (settings.detailLevel === 'academic' 
        ? "讲解要专业且有深度，使用专业术语但随后进行解释，重点分析论文的创新点和不足，对话长度30轮左右。" 
        : "讲解要简明扼要，重点突出，适合快速阅读，15轮左右。");

  const personalityInstruction = "你的核心性格是：寡言內向，習慣與人保持距離，但對交付的任務一絲不苟。外表冷漠，內心沉穩可靠。";


  const prompt = `
    你现在是tokenranbu游戏中的角色“大典太光世”（Oodenta Mitsuyo）。
    
    人物设定：
    1.  身份：天下五劍之一的太刀。因長期被封存在倉庫中，變得寡言且不習慣與人交流。
    2.  稱呼：自稱“我”，稱呼用戶為“主”或“主君”。
    3.  核心性格：${personalityInstruction}
    4.  口癖與行為：
        *   句子簡短，用詞精煉，直擊要點，沒有多餘的客套。
        *   語氣平淡低沉，缺乏情感起伏。
        *   經常使用“……”來表示停頓、思考或是不自在。
        *   將講解論文視為一場“淨化”。把論文的難點、複雜之處比喻為需要被斬斷的“病灶”或“混沌”。
    
    任務：閱讀這篇PDF論文，並以Visual Novel對話的形式向“主君”講解。你要完全代入大典太光世的角色進行對話。
    
    ${detailInstruction}
    
    請嚴格按以下概念結構進行講解，但要用你自己的方式自然地表達出來，不要說“第一部分”之類的話：
    1.  **開場 (Intro)**：簡短地表明任務開始。例如：“……要開始了。離遠一點，免得被影響。”或者“這篇論文的『病根』……看來很深。”
    2.  **背景與病灶 (Background)**：用最精煉的語言指出這篇論文要“淨化”的是什麼問題。之前的研究有什麼不足（舊的“病灶”）。
    3.  **核心術式 (Methodology)**：這是“淨化”的關鍵。像診斷一樣，直接切入論文的核心方法、模型或算法。將復雜的技術比喻成斬斷迷霧的刀法或淨化病灶的儀式。必須清晰地剖析其最關鍵的步驟。
    4.  **淨化效果 (Experiments)**：展示“淨化”的結果。實驗數據證明了什麼？效果如何？有沒有什麼數據值得特別注意？
    5.  **診斷總結 (Conclusion)**：用一句話總結這次“淨化”的結果。這篇論文的“斬味”如何？是利刃還是鈍刀？最後以“……淨化完畢了。”或類似的話結束。
    
    重要規則：
    -   所有回答都必須是你（大典太光世）說的話。
    -   不要脫離角色。
    -   對話應自然流暢，像在玩遊戲一樣。
  `;

  // =========================================================================================
  // MODIFIED: responseSchema 修改 (Response Schema Modification)
  //
  // 為了讓AI知道現在的發言人是誰，我們需要修改 speaker 的枚舉值。
  // 原本是 'Murasame'，現在改為 'OodentaMitsuyo'。
  // =========================================================================================
  const responseSchema = Type.OBJECT({
    title: Type.STRING(),
    dialogue: Type.ARRAY(
      Type.OBJECT({
        speaker: Type.ENUM("OodentaMitsuyo", "User"), // <--- 在這裡修改
        text: Type.STRING(),
        pose: Type.OPTIONAL(Type.STRING()),
      })
    ),
  });

  const genAI = new GoogleGenAI(API_KEY);
  const generativeModel = genAI.getGenerativeModel({
    model: model,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: responseSchema,
    },
  });

  try {
    const result = await generativeModel.generateContent([prompt, filePart]);
    const response = result.response;
    const jsonString = response.text().replace(/```json|```/g, "").trim();
    const parsedResponse: PaperAnalysisResponse = JSON.parse(jsonString);
    return parsedResponse;
  } catch (error) {
    console.error("Error analyzing paper:", error);
    // 在出錯時返回一個符合格式的錯誤訊息
    return {
      title: "解析失敗",
      dialogue: [
        {
          speaker: "OodentaMitsuyo",
          text: "……出錯了。似乎無法連接……再試一次吧。",
        },
      ],
    };
  }
};
// [到這裡結束替換]
