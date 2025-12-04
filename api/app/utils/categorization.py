import os
import json
import traceback
from typing import List
import time

# 尝试导入OpenAI客户端，如果失败则使用模拟实现
try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    print("⚠️ OpenAI library not available, using mock implementation")
    OPENAI_AVAILABLE = False

# 从环境变量获取配置 - 使用专门的分类功能配置
BASE_URL = os.environ.get('CATEGORIZATION_OPENAI_BASE_URL', 'https://api.siliconflow.cn/v1')
API_KEY = os.environ.get('CATEGORIZATION_OPENAI_API_KEY', '')
# 使用兼容的模型名称
MODEL = os.environ.get('CATEGORIZATION_OPENAI_MODEL', 'Qwen/Qwen2.5-7B-Instruct')

# 初始化OpenAI客户端（如果可用）
client = None
if OPENAI_AVAILABLE and API_KEY:
    client = OpenAI(base_url=BASE_URL, api_key=API_KEY)
    # 安全地格式化API密钥显示
    api_key_display = '***' + API_KEY[-4:] if len(API_KEY) > 4 else '***'
    print(f'✅ Categorization OpenAI Client initialized:\n   📍 Base URL: {BASE_URL}\n   🤖 Model: {MODEL}\n   🔑 API Key: {api_key_display}')
else:
    print(f'⚠️ OpenAI client not initialized (API key: {"available" if API_KEY else "not available"})')

# 预定义分类类别
PREDEFINED_CATEGORIES = [
    "个人信息", "技术", "学习", "工作", "生活", "健康", 
    "娱乐", "旅行", "财务", "家庭", "社交", "饮食", "喜好", "其他"
]

# 关键词匹配分类（作为后备方案）
CATEGORY_KEYWORDS = {
    "个人信息": ["名字", "电话", "邮箱", "地址", "生日", "身份", "账号", "密码", "证件"],
    "技术": ["编程", "代码", "开发", "项目", "Python", "JavaScript", "Java", "C++", "前端", "后端", "API", "数据库", "AI", "模型"],
    "学习": ["学习", "课程", "考试", "作业", "研究", "论文", "知识", "书", "阅读"],
    "工作": ["工作", "公司", "会议", "项目", "任务", "汇报", "合作", "同事", "老板", "客户"],
    "生活": ["睡觉", "购物", "电影", "音乐", "运动", "日常", "天气"],
    "饮食": ["吃", "喝", "水果", "菜", "饭", "酒", "茶", "咖啡", "早餐", "午餐", "晚餐", "零食", "口味", "辣", "甜"],
    "喜好": ["喜欢", "爱", "讨厌", "不喜欢", "偏好", "感兴趣", "粉丝", "最爱"],
    "健康": ["身体", "疾病", "医院", "医生", "药物", "锻炼", "减肥", "体重", "身高"],
    "旅行": ["旅游", "旅行", "景点", "酒店", "机票", "行程", "城市", "出差", "签证"],
    "财务": ["钱", "工资", "投资", "股票", "银行", "支出", "收入", "账单", "消费"],
    "家庭": ["父母", "孩子", "配偶", "家人", "亲戚", "家务", "家庭", "老公", "老婆", "儿子", "女儿", "爸", "妈"],
    "社交": ["朋友", "聚会", "活动", "聊天", "交流", "沟通", "社交", "群"],
    "娱乐": ["游戏", "玩", "漫画", "动漫", "综艺", "剧"],
}

def keyword_based_categorization(text: str) -> List[str]:
    """
    基于关键词的简单分类（作为LLM失败时的后备方案）
    """
    categories = []
    text_lower = text.lower()
    
    for category, keywords in CATEGORY_KEYWORDS.items():
        if any(keyword.lower() in text_lower for keyword in keywords):
            categories.append(category)
    
    # 如果没有匹配到任何分类，返回"其他"
    if not categories:
        categories.append("其他")
    
    return categories

def get_categories_for_memory(memory: str) -> List[str]:
    """
    为记忆文本获取分类
    优先使用LLM分类，失败时回退到关键词匹配
    """
    print('===== GET_CATEGORIES_FOR_MEMORY CALLED =====')
    print(f'Memory: {memory}')
    print(f'Model: {MODEL}')
    
    
    # 首先尝试使用LLM分类
    if OPENAI_AVAILABLE and client:
        # 构建清晰的提示词
        prompt = f"""请分析以下文本，并将其归类到最合适的一个或多个类别中。
请只从以下预定义类别中选择：{', '.join(PREDEFINED_CATEGORIES)}。

规则：
1. 如果内容涉及吃的、喝的，请包含"饮食"。
2. 如果内容表达了喜爱、厌恶等偏好，请包含"喜好"。
3. 如果内容包含姓名、联系方式等，请包含"个人信息"。
4. 尽量不要使用"其他"，除非内容完全无法归类。
5. 以JSON格式返回，格式为: {{"categories": ["类别1", "类别2"]}}

文本: {memory}"""
        
        print(f'Using LLM for categorization...')
        
        # 尝试多次调用以防临时失败
        max_retries = 2
        for attempt in range(max_retries + 1):
            try:
                response = client.chat.completions.create(
                    model=MODEL,
                    messages=[
                        {"role": "system", "content": "你是一个精确的文本分类助手。请严格按照用户的要求，只从预定义类别中选择合适的分类，并以JSON格式返回。"},
                        {"role": "user", "content": prompt},
                    ],
                    temperature=0.0,
                    timeout=10,
                )
                
                content = response.choices[0].message.content.strip()
                print(f'LLM response (attempt {attempt + 1}): {content}')
                
                # 清理并解析JSON
                if content.startswith('```json'):
                    content = content[7:]
                if content.endswith('```'):
                    content = content[:-3]
                content = content.strip()
                
                response_json = json.loads(content)
                
                if isinstance(response_json, dict) and 'categories' in response_json:
                    categories = response_json['categories']
                    if categories and isinstance(categories, list):
                        print(f'Successfully categorized using LLM: {categories}')
                        return categories
                
            except Exception as e:
                print(f'LLM categorization failed (attempt {attempt + 1}/{max_retries + 1}): {str(e)}')
                if attempt < max_retries:
                    print(f'Retrying in 1 second...')
                    time.sleep(1)
                else:
                    traceback.print_exc()
    
    # 如果LLM分类失败，使用关键词匹配作为后备
    print('Falling back to keyword-based categorization')
    categories = keyword_based_categorization(memory)
    print(f'Keyword-based categorization result: {categories}')
    return categories
