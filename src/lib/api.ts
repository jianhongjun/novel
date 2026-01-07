/**
 * 统一的 API 服务
 */

import CryptoJS from 'crypto-js';

const API_KEY = 'weimi_novel_key_20251223';
const API_BASE_URL = 'https://business.umeweb.cn';

/**
 * 生成签名
 * 参数名(key)首字母以 ASCII 升序排列,排序后的结果按照参数名(key)参数值(value)进行拼接
 * 格式：key1value1key2value2…keyNvalueN
 * 在参数字符串 S1头部拼接key,得到签名字符串,对签名字符串小写处理，然后MD5 32位小写
 */
function generateSign(params: Record<string, string>): string {
  // 排除 sign 参数，按 key 的 ASCII 升序排列
  const sortedKeys = Object.keys(params)
    .filter(key => key !== 'sign')
    .sort((a, b) => a.localeCompare(b));
  
  // 拼接参数字符串：key1value1key2value2...
  const paramString = sortedKeys
    .map(key => `${key}${params[key]}`)
    .join('');
  // 在头部拼接 key
  const signString = `${API_KEY}${paramString}`;
  // 小写处理
  const lowerSignString = signString.toLowerCase();
  // MD5 32位小写
  const hash = CryptoJS.MD5(lowerSignString).toString();
  return hash;
}

/**
 * 获取用户唯一 ID（从 localStorage 或生成）
 * 注意：需要在客户端环境使用
 */
export function getUserId(): string {
  if (typeof window === 'undefined') {
    // 服务端渲染时返回临时 ID
    return 'temp_user_id';
  }
  
  try {
    const storageKey = 'novel_user_id';
    let userId = localStorage.getItem(storageKey);
    
    if (!userId) {
      // 生成一个唯一的用户 ID
      userId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
      try {
        localStorage.setItem(storageKey, userId);
      } catch (storageError) {
        // localStorage 可能被禁用（如 iOS 隐私模式），使用临时 ID
        console.warn('localStorage 不可用，使用临时用户 ID:', storageError);
        return userId; // 仍然返回生成的 ID，但不保存
      }
    }
    
    return userId;
  } catch (error) {
    // 如果 localStorage 完全不可用，生成一个临时 ID
    console.warn('获取用户 ID 失败，使用临时 ID:', error);
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }
}

/**
 * 获取推荐小说列表
 */
export async function getRecommendNovels(): Promise<NovelItem[]> {
  try {
    const uid = getUserId();
    const timestamp = Date.now().toString();
    
    // 构建参数对象
    const params: Record<string, string> = {
      uid,
      timestamp
    };
    
    // 生成签名
    const sign = generateSign(params);
    params.sign = sign;
    
    console.log('请求推荐小说，参数:', { uid, timestamp, sign: sign.substring(0, 8) + '...' });
    
    // 发送请求
    const response = await fetch(`${API_BASE_URL}/browser_business/novel/recommend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });
    
    console.log('API 响应状态:', response.status, response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('HTTP 错误响应:', errorText);
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText.substring(0, 100)}`);
    }
    
    const data = await response.json();
    console.log('API 返回数据:', { code: data.code, hasResult: !!data.result, resultLength: data.result?.length });
    
    if (data.code !== 200) {
      const errorMsg = data.message || '获取推荐小说失败';
      console.error('API 返回错误:', errorMsg, data);
      throw new Error(errorMsg);
    }
    
    // 转换数据格式
    const novels = (data.result || []).map((item: ApiNovelItem, index: number) => ({
      id: item.cbid, // 如果没有 id，使用索引
      title: item.title,
      author: item.author,
      status: item.status,
      cover: item.cover,
      freeType: item.freeType,
      category: item.category,
      recommend: item.recommend,
      bookshelf: item.bookshelf,
    }));
    
    console.log('成功获取小说列表，数量:', novels.length);
    return novels;
  } catch (error) {
    console.error('获取推荐小说失败:', error);
    // 提供更详细的错误信息
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('网络请求失败，请检查网络连接');
    }
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('获取推荐小说失败，请稍后重试');
  }
}

/**
 * 分类项数据类型
 */
export interface CategoryItem {
  cover: string;
  category: string;
}

/**
 * 分类列表数据类型
 */
export interface CategoryList {
  '1': CategoryItem[]; // 男频
  '2': CategoryItem[]; // 女频
  '3': CategoryItem[]; // 出版物
}

/**
 * 前端使用的分类组数据类型
 */
export interface CategoryGroup {
  type: string;
  list: Array<{
    id: number;
    name: string;
    image: string;
  }>;
}

/**
 * 获取分类列表
 */
export async function getCategoryList(): Promise<CategoryGroup[]> {
  try {
    const timestamp = Date.now().toString();
    
    // 构建参数对象
    const params: Record<string, string> = {
      timestamp
    };
    
    // 生成签名
    const sign = generateSign(params);
    
    // 发送请求
    const response = await fetch(`${API_BASE_URL}/browser_business/novel/category`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sign: sign,
        timestamp: parseInt(timestamp)
      }),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.code !== 200) {
      throw new Error(data.message || '获取分类列表失败');
    }
    
    // 转换数据格式
    const result: CategoryList = data.result || {};
    const categoryGroups: CategoryGroup[] = [];
    
    // 处理男频 (1)
    if (result['1'] && result['1'].length > 0) {
      categoryGroups.push({
        type: '男频',
        list: result['1'].map((item, index) => ({
          id: index + 1,
          name: item.category,
          image: item.cover
        }))
      });
    }
    
    // 处理女频 (2)
    if (result['2'] && result['2'].length > 0) {
      categoryGroups.push({
        type: '女频',
        list: result['2'].map((item, index) => ({
          id: index + 1,
          name: item.category,
          image: item.cover
        }))
      });
    }
    
    // 处理出版物 (3)
    if (result['3'] && result['3'].length > 0) {
      categoryGroups.push({
        type: '出版物',
        list: result['3'].map((item, index) => ({
          id: index + 1,
          name: item.category,
          image: item.cover
        }))
      });
    }
    
    return categoryGroups;
  } catch (error) {
    console.error('获取分类列表失败:', error);
    throw error;
  }
}

/**
 * API 返回的小说数据类型
 */
interface ApiNovelItem {
  cover: string;
  bookshelf: boolean;
  author: string;
  freeType: number;
  recommend: string;
  title: string;
  category: string;
  status: string;
  cbid: string;
}

/**
 * 分类列表返回的小说数据类型
 */
export interface CategoryListBookItem {
  cbid: string;
  title: string;
  intro: string;
  freeTypeName: string;
  categoryName: string;
  subCategoryName: string;
  allWords: number;
  allChapter: number;
  freeChapters: number;
  authorName: string;
  coverUrl: string;
  status: string;
  tags: string[];
  updateTime: string;
  site: string;
}

/**
 * 分类列表返回的数据类型
 */
export interface CategoryListResponse {
  total: number;
  pages: number;
  data: CategoryListBookItem[];
}

/**
 * 前端使用的分类列表小说数据类型
 */
export interface CategoryListBook {
  id: string;
  cbid: string;
  title: string;
  intro: string;
  freeTypeName: string;
  categoryName: string;
  subCategoryName: string;
  allWords: number;
  allChapter: number;
  freeChapters: number;
  authorName: string;
  coverUrl: string;
  status: string;
  tags: string[];
  updateTime: string;
  site: string;
}

/**
 * 获取分类列表的小说
 */
export async function getCategoryListBooks(params: {
  category: string;
  freeType: number;
  pageNum?: number;
  pageSize?: number;
}): Promise<{
  books: CategoryListBook[];
  total: number;
  pages: number;
}> {
  try {
    const timestamp = Date.now().toString();
    const pageNum = params.pageNum || 1;
    const pageSize = params.pageSize || 20;
    
    // 构建参数对象（用于签名）
    const signParams: Record<string, string> = {
      timestamp,
      pageNum: pageNum.toString(),
      pageSize: pageSize.toString(),
      category: params.category,
      freeType: params.freeType.toString()
    };
    
    // 生成签名
    const sign = generateSign(signParams);
    
    // 发送请求
    const response = await fetch(`${API_BASE_URL}/browser_business/novel/category_list`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sign: sign,
        timestamp: parseInt(timestamp),
        pageNum: pageNum,
        pageSize: pageSize,
        category: params.category,
        freeType: params.freeType
      }),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.code !== 200) {
      throw new Error(data.message || '获取分类列表失败');
    }
    
    const result: CategoryListResponse = data.result || { total: 0, pages: 0, data: [] };
    
    // 转换数据格式
    const books: CategoryListBook[] = result.data.map((item) => ({
      id: item.cbid,
      cbid: item.cbid,
      title: item.title,
      intro: item.intro || '',
      freeTypeName: item.freeTypeName || '',
      categoryName: item.categoryName || '',
      subCategoryName: item.subCategoryName || '',
      allWords: item.allWords || 0,
      allChapter: item.allChapter || 0,
      freeChapters: item.freeChapters || 0,
      authorName: item.authorName || '',
      coverUrl: item.coverUrl || '',
      status: item.status || '连载',
      tags: item.tags || [],
      updateTime: item.updateTime || '',
      site: item.site || ''
    }));
    
    return {
      books,
      total: result.total,
      pages: result.pages
    };
  } catch (error) {
    console.error('获取分类列表失败:', error);
    throw error;
  }
}

/**
 * 书籍详情返回的数据类型
 */
export interface BookInfoItem {
  cbid: string;
  title: string;
  intro: string;
  freeTypeName: string;
  categoryName: string;
  subCategoryName: string;
  allWords: number;
  allChapter: number;
  freeChapters: number;
  authorName: string;
  coverUrl: string;
  status: string;
  tags: string[];
  updateTime: string;
  site: string;
}

/**
 * 前端使用的书籍详情数据类型
 */
export interface BookInfo {
  id: string;
  cbid: string;
  title: string;
  authorName: string;
  coverUrl: string;
  intro: string;
  status: string;
  freeTypeName: string;
  categoryName: string;
  subCategoryName: string;
  allWords: number;
  allChapter: number;
  freeChapters: number;
  tags: string[];
  updateTime: string;
  site: string;
}

/**
 * 获取书籍详情
 */
export async function getBookInfo(cbid: string): Promise<BookInfo> {
  try {
    const timestamp = Date.now().toString();
    
    // 构建参数对象（用于签名）
    const signParams: Record<string, string> = {
      timestamp,
      cbid
    };
    
    // 生成签名
    const sign = generateSign(signParams);
    
    // 发送请求
    const response = await fetch(`${API_BASE_URL}/browser_business/novel/info`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cbid: cbid,
        sign: sign,
        timestamp: parseInt(timestamp)
      }),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.code !== 200) {
      throw new Error(data.message || '获取书籍详情失败');
    }
    
    const result: BookInfo = data.result || {} as BookInfo;
    
    // 转换数据格式
    const bookInfo: BookInfo = {
      id: result.cbid,
      cbid: result.cbid,
      title: result.title || '',
      authorName: result.authorName || '',
      site: result.site ? `来源${result.site}` : '',
      coverUrl: result.coverUrl || '',
      intro: result.intro || '',
      status: result.status || '连载',
      freeTypeName: result.freeTypeName || '',
      categoryName: result.categoryName || '',
      subCategoryName: result.subCategoryName || '',
      allWords: result.allWords || 0,
      allChapter: result.allChapter || 0,
      freeChapters: result.freeChapters || 0,
      tags: result.tags || [],
      updateTime: result.updateTime || ''
    };
    
    return bookInfo;
  } catch (error) {
    console.error('获取书籍详情失败:', error);
    throw error;
  }
}

/**
 * 章节列表返回的章节数据类型
 */
export interface ChapterListItem {
  ccid: string;
  cbid: string;
  cvid: string;
  volumeName: string;
  chapterOrder: number;
  chapterTitle: string;
  chapterType: number;
  originalWords: number;
  actualWords: number;
  payFlag: number;
  amount: number;
  contentMd5: string;
  updateTime: string;
  publishTime: string;
  prevCcid: string;
  nextCcid: string;
  chapterExtra: string;
}

/**
 * 章节列表返回的数据类型
 */
export interface ChapterListResponse {
  totalCount: number;
  resultData: ChapterListItem[];
  pages: number;
}

/**
 * 章节内容返回的数据类型
 */
export interface ChapterContentItem {
  ccid: string;
  cbid: string;
  cvid: string;
  chapterOrder: number;
  chapterTitle: string;
  chapterType: number;
  originalWords: number;
  actualWords: number;
  payFlag: number;
  amount: number;
  updateTime: string;
  publishTime: string;
  prevCcid: string;
  nextCcid: string;
  isTaked: number;
  content: string;
  contentMd5: string;
}

/**
 * 获取章节列表
 */
export async function getChapterList(params: {
  cbid: string;
  pageNum?: number;
  pageSize?: number;
}): Promise<ChapterListResponse> {
  try {
    const timestamp = Date.now().toString();
    const pageNum = params.pageNum || 1;
    const pageSize = params.pageSize || 20;
    
    // 构建参数对象（用于签名）
    const signParams: Record<string, string> = {
      timestamp,
      cbid: params.cbid,
      pageNum: pageNum.toString(),
      pageSize: pageSize.toString()
    };
    
    // 生成签名
    const sign = generateSign(signParams);
    
    // 发送请求
    const response = await fetch(`${API_BASE_URL}/browser_business/novel/chapter_list`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cbid: params.cbid,
        pageNum: pageNum,
        pageSize: pageSize,
        sign: sign,
        timestamp: parseInt(timestamp)
      }),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.code !== 200) {
      throw new Error(data.message || '获取章节列表失败');
    }
    
    const result: ChapterListResponse = data.result || { totalCount: 0, resultData: [],pages:0 };
    
    // 返回原始数据，方便查看结构
    //console.log('章节列表接口返回数据:', result);
    return result;
  } catch (error) {
    console.error('获取章节列表失败:', error);
    throw error;
  }
}

/**
 * 获取章节内容
 */
export async function getChapterContent(params: {
  cbid: string;
  ccid: string;
  uid?: string;
}): Promise<ChapterContentItem> {
  try {
    const timestamp = Date.now().toString();
    const uid = params.uid || getUserId();
    
    // 构建参数对象（用于签名）
    const signParams: Record<string, string> = {
      timestamp,
      cbid: params.cbid,
      uid: uid,
      ccid: params.ccid
    };
    
    // 生成签名
    const sign = generateSign(signParams);
    
    // 发送请求
    const response = await fetch(`${API_BASE_URL}/browser_business/novel/chapter_content`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cbid: params.cbid,
        uid: uid,
        ccid: params.ccid,
        sign: sign,
        timestamp: parseInt(timestamp)
      }),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.code !== 200) {
      throw new Error(data.message || '获取章节内容失败');
    }
    
    const result: ChapterContentItem = data.result || {} as ChapterContentItem;
    
    // 返回原始数据，方便查看结构
    //console.log('章节内容接口返回数据:', result);
    return result;
  } catch (error) {
    console.error('获取章节内容失败:', error);
    throw error;
  }
}

/**
 * 前端使用的小说数据类型
 */
export interface NovelItem {
  id: number;
  title: string;
  author: string;
  status: string;
  cover: string;
  freeType: number;
  category?: string;
  recommend?: string;
  bookshelf?: boolean;
}

