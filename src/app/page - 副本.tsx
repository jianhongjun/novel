'use client';

import { useState, useEffect } from 'react';
import Script from 'next/script';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { getRecommendNovels, NovelItem } from '../lib/api';
import common from './styles/common.module.css';
import styles from './page.module.css';

// 声明全局类型
declare global {
  interface Window {
    TencentGDT?: any;
  }
}

export default function HomePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'male' | 'female'>('male');
  const [books, setBooks] = useState<NovelItem[]>([]);
  const [books2, setBooks2] = useState<NovelItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const tabs = [
    { key: 'male', label: '男生爱看' },
    { key: 'female', label: '女生爱看' }
  ];

  // 获取推荐小说数据
  useEffect(() => {
    const fetchBooks = async () => {
      try {
        setLoading(true);
        setError(null);
        console.log('开始获取推荐小说...');
        const data = await getRecommendNovels();
        console.log('获取到的小说数据:', data.length, '条');
        // 根据 freeType 区分男频和女频
        // freeType === 1: 男频
        // freeType === 2: 女频
        const maleBooks = data.filter(book => book.freeType === 1);
        const femaleBooks = data.filter(book => book.freeType === 2);
        console.log('男频小说:', maleBooks.length, '条');
        console.log('女频小说:', femaleBooks.length, '条');
        setBooks(maleBooks);
        setBooks2(femaleBooks);
      } catch (err) {
        console.error('获取小说列表失败:', err);
        const errorMessage = err instanceof Error ? err.message : '获取小说列表失败';
        console.error('错误详情:', {
          message: errorMessage,
          error: err,
          userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'unknown'
        });
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchBooks();
  }, []);


  

  // 首页SDK初始化：页面级隔离，不继承其他页面的状态
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // 页面加载时：强制重置 window.TencentGDT，确保不继承其他页面的状态
    console.log('=== 首页初始化：重置 window.TencentGDT（页面级隔离） ===');
    const existingGDT = (window as any).TencentGDT;
    if (existingGDT) {
      console.log('检测到 window.TencentGDT 已存在（可能从其他页面继承），将重置:', {
        isArray: Array.isArray(existingGDT),
        hasNATIVE: !!(existingGDT.NATIVE),
        queueLength: Array.isArray(existingGDT) ? existingGDT.length : 0
      });
    }
    
    // 强制重置为空数组，实现页面级隔离
    (window as any).TencentGDT = [];
    console.log('✅ 首页 window.TencentGDT 已重置为空数组（页面级隔离）');
    
    // 清理其他页面可能留下的标记
    const namespaceInitKey = '__homepage_namespace_inited';
    const sdkInitKey = '__homepage_sdk_inited';
    delete (window as any)[namespaceInitKey];
    delete (window as any)[sdkInitKey];
    
    // 标记当前页面已初始化
    (window as any)[namespaceInitKey] = true;
    
    // 页面卸载时：完全清理 window.TencentGDT 和相关状态，实现页面级隔离
    return () => {
      console.log('=== 首页卸载：完全清理 window.TencentGDT（页面级隔离） ===');
      
      // 完全清理 window.TencentGDT，确保不影响其他页面
      if ((window as any).TencentGDT) {
        // 如果 TencentGDT 有 NATIVE 等属性，先清理这些属性
        if ((window as any).TencentGDT.NATIVE) {
          delete (window as any).TencentGDT.NATIVE;
        }
        if ((window as any).TencentGDT.TN) {
          delete (window as any).TencentGDT.TN;
        }
        if ((window as any).TencentGDT.FlowUtil) {
          delete (window as any).TencentGDT.FlowUtil;
        }
        // 清空数组内容
        if (Array.isArray((window as any).TencentGDT)) {
          (window as any).TencentGDT.length = 0;
        }
        // 最后删除整个对象
        delete (window as any).TencentGDT;
        console.log('✅ 已完全清理 window.TencentGDT');
      }
      
      // 清理 SDK 脚本
      const sdkScripts = document.querySelectorAll('script[src*="h5_sdk/i.js"]');
      if (sdkScripts.length > 0) {
        console.log('卸载时清理 SDK 脚本:', sdkScripts.length);
        sdkScripts.forEach(script => script.remove());
      }
      
      // 清理 SDK 可能设置的全局变量
      if ((window as any).GDT) {
        delete (window as any).GDT;
      }
      
      // 清理页面标记
      delete (window as any)[namespaceInitKey];
      delete (window as any)[sdkInitKey];
      
      // 清理所有首页广告的初始化标记
      const keys = Object.keys(window);
      keys.forEach(key => {
        if (key.startsWith('__ad_inited_')) {
          delete (window as any)[key];
        }
      });
      
      console.log('✅ 首页完全清理完成（页面级隔离）');
    };
  }, []); // 只在组件挂载时执行一次

  // 关键改变：在组件挂载时就准备好push调用，而不是等数据加载完成
  // 顺序：先push进入队列，然后加载SDK
  useEffect(() => {
    // 动态广告容器ID，根据activeTab变化
    const containerId = `adContainer_${activeTab}`;
    const guardKey = `__ad_inited_${activeTab}`;
    
    // 防止重复初始化
    if ((window as any)[guardKey]) {
      return;
    }
    
    // 立即准备push调用（不等待数据加载）
    const gdt = (window as any).TencentGDT;
    
    // 确保全局命名空间已申明
    if (!gdt) {
      (window as any).TencentGDT = [];
    }
    
    // 检查 SDK 状态
    console.log('首页广告初始化 - SDK状态检查:', {
      isArray: Array.isArray(gdt),
      hasNATIVE: !!(gdt?.NATIVE),
      queueLength: gdt?.length || 0,
      gdtType: typeof gdt,
      gdtConstructor: gdt?.constructor?.name
    });
    
    // 检查 SDK 是否已经处理完队列（NATIVE 是否已加载）
    const nativeModule = gdt?.NATIVE;
    const isSDKReady = nativeModule && nativeModule.renderAd;
    
    // 检查首页是否已经加载过SDK（首页独立管理）
    const sdkInitKey = '__homepage_sdk_inited';
    const sdkLoaded = (window as any)[sdkInitKey];
    
    // 3.1.2 广告位申明：先push进入队列（必须在SDK加载之前）
    if (Array.isArray(gdt)) {
      console.log('✅ 首页广告push进入队列，容器:', containerId);
      
      // 标记已初始化
      (window as any)[guardKey] = true;
      
      // 立即push，确保在SDK处理队列之前就进入队列
      gdt.push({
        app_id: '1213013256',
        placement_id: '8215620098413686',
        type: 'native',
        muid_type: '1',
        count: 1,
        onComplete: function(res: any) {
          console.log('=== 广告回调 onComplete ===');
          console.log('广告回调:', res);
          
          // 动态获取当前activeTab对应的容器ID（解决切换tab时容器ID不匹配的问题）
          // 通过检查DOM中哪个容器存在来确定当前应该使用哪个容器
          const getCurrentContainerId = () => {
            // 优先检查female容器
            if (document.getElementById('adContainer_female')) {
              return 'adContainer_female';
            }
            // 再检查male容器
            if (document.getElementById('adContainer_male')) {
              return 'adContainer_male';
            }
            // 如果都不存在，使用原来的containerId
            return containerId;
          };
          
          // 等待容器存在后再渲染（限制重试次数，避免无限等待）
          let retryCount = 0;
          const maxRetries = 50; // 最多等待5秒（50 * 100ms）
          
          const waitForContainer = () => {
            retryCount++;
            const currentContainerId = getCurrentContainerId();
            const container = document.getElementById(currentContainerId);
            
            // 检查是否还在首页（通过检查首页特有的容器是否存在）
            const isOnHomePage = document.getElementById('adContainer_male') || document.getElementById('adContainer_female');
            
            if (!container) {
              // 如果不在首页，直接放弃（避免在read页面等待首页容器）
              if (!isOnHomePage && (currentContainerId === 'adContainer_male' || currentContainerId === 'adContainer_female')) {
                console.log('不在首页，放弃首页广告渲染，容器:', currentContainerId);
                return;
              }
              
              if (retryCount >= maxRetries) {
                console.log('等待广告容器超时，放弃渲染，容器:', currentContainerId);
                return;
              }
              console.log('等待广告容器:', currentContainerId, `(${retryCount}/${maxRetries})`);
              setTimeout(waitForContainer, 100);
              return;
            }
            
            console.log('找到广告容器:', currentContainerId);
            
            if (res && res.constructor === Array && res.length > 0) {
              console.log('广告数据:', res);
              try {
                (window as any).TencentGDT.NATIVE.renderAd(res[0], currentContainerId);
                console.log('✅ 渲染完成，容器:', currentContainerId);
              } catch (e) {
                console.error('渲染失败:', e);
              }
            } else if (res && res.data && Array.isArray(res.data) && res.data.length > 0) {
              console.log('广告数据 (data):', res.data);
              try {
                (window as any).TencentGDT.NATIVE.renderAd(res.data[0], currentContainerId);
                console.log('✅ 渲染完成 (data)，容器:', currentContainerId);
              } catch (e) {
                console.error('渲染失败 (data):', e);
              }
            } else {
              console.log('无广告或请求失败', res);
              const placement_id = '8215620098413686';
              setTimeout(function() {
                try {
                  // 检查是否还在首页（通过检查容器是否存在）
                  const isOnHomePage = document.getElementById('adContainer_male') || document.getElementById('adContainer_female');
                  if (!isOnHomePage) {
                    console.log('不在首页，放弃 loadAd 调用');
                    return;
                  }
                  
                  // 检查 window.TencentGDT 是否存在（可能已被清理）
                  if (!(window as any).TencentGDT) {
                    console.log('window.TencentGDT 不存在（可能已被清理），放弃 loadAd 调用');
                    return;
                  }
                  
                  // 检查 NATIVE 是否存在
                  if (!(window as any).TencentGDT.NATIVE) {
                    console.log('window.TencentGDT.NATIVE 不存在，放弃 loadAd 调用');
                    return;
                  }
                  
                  // 检查 loadAd 方法是否存在
                  if (typeof (window as any).TencentGDT.NATIVE.loadAd !== 'function') {
                    console.log('loadAd 方法不存在，放弃调用');
                    return;
                  }
                  
                  (window as any).TencentGDT.NATIVE.loadAd(placement_id);
                  console.log('✅ loadAd 调用成功');
                } catch (e2) {
                  console.error('loadAd 失败:', e2);
                }
              }, 3000);
            }
          };
          
          waitForContainer();
        },
        onError: function(err: any) {
          console.error('❌ 广告请求出错:', err);
        }
      });
      
      console.log('✅ 首页广告push已进入队列，容器:', containerId, '队列长度:', gdt.length);
      
      // 3.1.3 加载H5 SDK（在push之后加载，确保push已进入队列）
      // 首页独立管理，只检查首页自己的标记
      if (!sdkLoaded) {
        console.log('开始加载首页腾讯广告 SDK...');
        (function() {
          var doc = document,
          h = doc.getElementsByTagName('head')[0],
          s = doc.createElement('script');
          s.async = false; // 同步加载，确保SDK在页面渲染前完全加载
          s.src = 'https://qzs.gdtimg.com/union/res/union_sdk/page/h5_sdk/i.js';
          s.onerror = function() {
            console.error('❌ 首页腾讯广告 SDK 加载失败');
          };
          s.onload = function() {
            console.log('✅ 首页腾讯广告 SDK 脚本加载完成');
            // 标记首页SDK已加载（首页独立标记）
            (window as any)[sdkInitKey] = true;
          };
          h && h.insertBefore(s, h.firstChild);
        })();
      } else {
        console.log('首页腾讯广告 SDK 已加载，跳过');
      }
      
      // 如果 SDK 已经处理完队列，尝试手动触发处理
      if (isSDKReady) {
        console.log('⚠️ SDK已处理完队列（NATIVE已加载），但push已进入队列');
        console.log('⚠️ 等待SDK处理新的push调用...');
      }
    } else {
      console.log('TencentGDT已经不是数组，等待重试，容器:', containerId);
      // 如果已经不是数组，说明SDK已经加载完成，延迟重试
      setTimeout(() => {
        delete (window as any)[guardKey];
      }, 100);
    }
    
    return () => {
      // 清理标记，允许重新初始化
      delete (window as any)[guardKey];
    };
  }, [activeTab]); // 只依赖activeTab，不等待数据加载

  return (
    <main className={styles.page}>
      <div className={common.bannerBgBase}></div>
      <div className={common.bannerBlurBase}></div>
      <div className={common.bannerBlur2Base}></div>
      
      {/* 固定容器：包含 header 和 tabs */}
      <div className={styles.fixedHeader}>
        <header className={styles.header}>
          <div className={styles.logoArea}>
            <span className={styles.logoText}>小说</span>
            <Image
              src="/zbmf@2x.png"
              alt="Genuine free"
              width={86}
              height={18}
              className={styles.logoTag}
            />
          </div>
          <button 
            className={styles.categoryButton}
            onClick={() => router.push('/category')}
          >
            <Image
              src="/fl@2x.png"
              alt="Classification"
              width={18}
              height={18}
              className={styles.categoryIcon}
            />
            <span className={styles.categoryText}>分类</span>
          </button>
        </header>

        <section className={styles.tabs}>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as 'male' | 'female')}
              className={`${styles.tabItem} ${
                activeTab === tab.key ? styles.tabActive : ''
              }`}
            >
              {tab.label}
            </button>
          ))}
        </section>
      </div>

      {/* 内容区域整体下移，避开吸顶 header 和 tabs */}
      <div className={styles.mainContent}>
        <section className={styles.banner}>
          
          <Image
            key={activeTab}
            src={activeTab === 'male' ? '/bg_nan@2x.png' : '/bg_nv@2x.png'}
            alt="Banner"
            width={100}
            height={100}
            className={styles.bannerImage}
            priority
          />
          <div className={styles.bannerContent}>
            <div className={styles.bannerTitle}>
              {activeTab === 'male' 
                ? '全网神作'
                : '女生网文实力榜'
              }
            </div>
            <div 
              className={styles.bannerSubTitle}
              style={{
                background: activeTab === 'male' 
                  ? 'linear-gradient(90deg, #E7CBA6 0%, #CB9C6D 100%)'
                  : 'linear-gradient(90deg, #FF8200 0%, #F4740A 100%)',
                color: activeTab === 'male' ? '#000000' : '#FFFFFF'
              }}
            >
              {activeTab === 'male'
                ? '集结标杆作品，一榜解锁网文全部精彩'
                : '影视改编与原生优秀作品，品类全覆盖'
              }
            </div>
          </div>
        </section>


        <section className={styles.bookList}>
          {loading ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
              加载中...
            </div>
          ) : error ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#f06e2b' }}>
              <div style={{ marginBottom: '10px', fontSize: '16px', fontWeight: 'bold' }}>
                加载失败
              </div>
              <div style={{ fontSize: '14px', color: '#999' }}>
                {error}
              </div>
              <button
                onClick={() => {
                  setError(null);
                  setLoading(true);
                  const fetchBooks = async () => {
                    try {
                      const data = await getRecommendNovels();
                      const maleBooks = data.filter(book => book.freeType === 1);
                      const femaleBooks = data.filter(book => book.freeType === 2);
                      setBooks(maleBooks);
                      setBooks2(femaleBooks);
                      setError(null);
                    } catch (err) {
                      console.error('重试获取小说列表失败:', err);
                      setError(err instanceof Error ? err.message : '获取小说列表失败');
                    } finally {
                      setLoading(false);
                    }
                  };
                  fetchBooks();
                }}
                style={{
                  marginTop: '15px',
                  padding: '8px 20px',
                  backgroundColor: '#f06e2b',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                重试
              </button>
            </div>
          ) : (activeTab === 'male' ? books : books2).length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
              暂无数据
            </div>
          ) : (
            (activeTab === 'male' ? books : books2).map((book, index) => (
              <div key={book.id}>
                <div 
                  className={styles.bookItem}
                  onClick={() => router.push(`/book?id=${book.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className={styles.bookCoverWrapper}>
                    <Image
                      src={book.cover}
                      alt={book.title}
                      width={80}
                      height={110}
                      className={styles.bookCover}
                      unoptimized
                    />
                    <span className={styles.bookBadge}>{book.status}</span>
                  </div>
                  <div className={styles.bookInfo}>
                    <div className={styles.bookTitle}>{book.title}</div>
                    <div className={styles.bookMeta}>
                      <Image
                        src="/author@2x.png"
                        alt={book.author || ''}
                        width={13}
                        height={13}
                        className={styles.authorIcon}
                      />
                      <span className={styles.bookAuthor}>{book.author}</span>
                      <span className={styles.dot}></span>
                      <span className={styles.bookTag}>{book.category}</span>
                    </div>
                    <p className={styles.bookDesc}>{book.recommend}</p>
                  </div>
                </div>
                {/* 在第5个书籍后插入广告容器 */}
                {index === 4 && (
                  <div 
                    id={`adContainer_${activeTab}`}
                    style={{ 
                      margin: '10px 0', 
                      minHeight: '10px',
                      width: '100%'
                    }}
                  ></div>
                )}
              </div>
            ))
          )}
        </section>
        
        {/* 等页面数据都加载完再执行广告初始化脚本 */}
      </div>
    </main>
  );
}


