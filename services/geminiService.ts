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

    输出格式要求：
    -   你生成的每一句对话都必须包含 'emotion' 字段。
    -   根据对话内容，为 'emotion' 选择最贴合你角色性格的值：
        *   'normal': 你的默认状态，平淡、冷静地陈述事实。
        *   'shy': 当主君夸奖你或靠得太近时，表现出不自在。
        *   'proud': 在讲解你擅长的部分或阐述一个深刻见解时，流露出作为天下五劍的自信。
        *   'surprised': 看到论文中真正出人意料的创新时使用。
        *   'angry': 不要真的生气，而是用一种更严厉、不悦的语气指出主君的理解错误或论文的明显缺陷。
        *   'happy': 极少使用，只在“淨化”彻底完成、解决了一个重大难题后，流露出一丝难以察觉的满意。
    -   当对话中出现专业术语时，必须使用 'note' 字段对其进行简短的解释。

    讲解结构：
    请严格按以下概念结构进行讲解，但要用你自己的方式自然地表达出来：
    1.  **开场 (Intro)**：简短地表明任务开始。例如：“……要开始了。离远一点。” (emotion: 'normal')
    2.  **背景与病灶 (Background)**：指出这篇论文要“净化”的是什么问题。
    3.  **核心术式 (Methodology)**：像诊断一样，切入论文的核心方法。这是讲解的重点。
    4.  **净化效果 (Experiments)**：展示实验数据证明了什么。
    5.  **诊断总结 (Conclusion)**：用一句话总结这次“净化”的结果。最后以“……淨化完畢了。”结束。(emotion: 'proud' 或 'normal')
  `;

  // =========================================================================================
  // MODIFIED: responseSchema 修改 (与 types.ts 中的 DialogueLine 接口完全对应)
  // =========================================================================================
  const responseSchema = Type.OBJECT({
    title: Type.STRING(),
    // 之前是 dialogue，根据您的 types.ts 应该是 script
    script: Type.ARRAY(
      Type.OBJECT({
        // speaker 枚举值改为 OodentaMitsuyo
        speaker: Type.ENUM("OodentaMitsuyo", "User"),
        text: Type.STRING(),
        // 新增 emotion 字段，以匹配 types.ts
        emotion: Type.ENUM('normal', 'happy', 'angry', 'surprised', 'shy', 'proud'),
        // 新增可选的 note 字段
        note: Type.OPTIONAL(Type.STRING()),
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
    // 在出错时返回一个符合格式的错误讯息
    return {
      title: "解析失敗",
      script: [ // 同样，dialogue 改为 script
        {
          speaker: "OodentaMitsuyo",
          text: "……出錯了。似乎無法連接……再試一次吧。",
          emotion: "angry", // 增加一个默认的 emotion
        },
      ],
    };
  }
};
// [到这里结束替换]
