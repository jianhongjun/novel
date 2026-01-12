'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { getCategoryList, CategoryGroup } from '../../lib/api';
import { getStaticLink } from '../../lib/staticLink';
import { useTarget } from '../../lib/useTarget';
import { useTargetParam } from '../../lib/useTargetParam';
import common from '../styles/common.module.css';
import styles from './page.module.css';

export default function CategoryPage() {
  const [activeTab, setActiveTab] = useState<'male' | 'female' | 'publish'>('male');
  const [categories, setCategories] = useState<CategoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const maleRef = useRef<HTMLDivElement>(null);
  const femaleRef = useRef<HTMLDivElement>(null);
  const publishRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const tabs = [
    { key: 'male', label: '男频' },
    { key: 'female', label: '女频' }
  ];

  // 获取 target 参数（客户端）
  const target = useTarget();
  
  // 使用 hook 动态更新所有链接的 target 参数（作为备用方案）
  useTargetParam();

  // 如果 URL 中没有 target 但 localStorage 中有，更新 URL
  useEffect(() => {
    if (typeof window === 'undefined' || !target) return;
    
    try {
      const urlParams = new URLSearchParams(window.location.search);
      if (!urlParams.has('target')) {
        // URL 中没有 target，但 localStorage 中有，更新 URL
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set('target', target);
        window.history.replaceState({}, '', newUrl.toString());
      }
    } catch (e) {
      // 忽略错误
    }
  }, [target]);

  // 调用分类接口
  useEffect(() => {
    const fetchCategoryData = async () => {
      try {
        setLoading(true);
        const data = await getCategoryList();
        setCategories(data);
        //console.log('分类接口返回的完整数据:', data);
      } catch (err) {
        console.error('获取分类数据失败:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCategoryData();
  }, []);

  useEffect(() => {
    const scrollToSection = () => {
      const container = contentRef.current;
      if (!container) return;

      if (activeTab === 'male') {
        setTimeout(() => {
          container.scrollTo({ top: 0, behavior: 'smooth' });
        }, 100);
        return;
      }

      let targetRef: React.RefObject<HTMLDivElement> | null = null;
      switch (activeTab) {
        case 'female':
          targetRef = femaleRef;
          break;
        case 'publish':
          targetRef = publishRef;
          break;
      }

      if (targetRef?.current) {
        setTimeout(() => {
          targetRef?.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
            inline: 'nearest'
          });
        }, 100);
      }
    };
    
    scrollToSection();
  }, [activeTab]);

  return (
    <main className={common.pageBase}>
      <div className={common.bannerBgBase}></div>
      <div className={common.bannerBlurBase}></div>
      <div className={common.bannerBlur2Base}></div>
      <div className={styles.container}>
        <header className={`${common.headerWithBackBase} ${styles.stickyHeader}`}>
          <a className={common.backButtonBase} href={target ? getStaticLink(`/?target=${encodeURIComponent(target)}`) : getStaticLink('/')} style={{ textDecoration: 'none', display: 'inline-block' }}>
            <Image
              src="/fh@2x.png"
              alt="返回"
              width={32}
              height={32}
              className={common.backIconBase}
              priority
              unoptimized
            />
          </a>
          <h1 className={styles.title}>分类</h1>
        </header>

        <section className={`${styles.tabs} ${styles.stickyTabs}`}>
          <div className={styles.tabsContainer}>
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as 'male' | 'female' | 'publish')}
                className={`${styles.tabItem} ${
                  activeTab === tab.key ? styles.tabActive : ''
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className={styles.tabsLine}></div>
        </section>
     
        <section className={styles.content} ref={contentRef}>
        {loading ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
            加载中...
          </div>
        ) : categories.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
            暂无分类数据
          </div>
        ) : (
          categories.map((categoryGroup, index) => {
            const sectionKey = categoryGroup.type === '男频' ? 'male' : 
                              categoryGroup.type === '女频' ? 'female' : 'publish';
            const sectionRef = sectionKey === 'male' ? maleRef : 
                             sectionKey === 'female' ? femaleRef : publishRef;
            
            return (
              <div key={categoryGroup.type} ref={sectionRef} className={styles.categoryGroup}>
                <h2 className={styles.sectionTitle}>{categoryGroup.type}</h2>
                <div className={styles.categoryList}>
                {categoryGroup.list.map((category) => {
                  // 根据 sectionKey 确定 freeType: male=1, female=2, publish=3
                  const freeType = sectionKey === 'male' ? 1 : sectionKey === 'female' ? 2 : 3;
                  return (
                  <a 
                    key={`${sectionKey}-${category.id}`} 
                    className={styles.categoryItem}
                    href={target ? getStaticLink(`/category-list?category=${encodeURIComponent(category.name)}&freeType=${freeType}&target=${encodeURIComponent(target)}`) : getStaticLink(`/category-list?category=${encodeURIComponent(category.name)}&freeType=${freeType}`)}
                    style={{ cursor: 'pointer' }}
                  >
                      <span className={styles.categoryName}>{category.name}</span>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={category.image}
                        alt={category.name}
                        width={93}
                        height={50}
                        className={styles.categoryImage}
                        onError={(e) => {
                          // 图片加载失败时使用默认图片
                          (e.target as HTMLImageElement).src = '/fl_1.png';
                        }}
                    />
                  </a>
                  );
                })}
                </div>
              </div>
            );
          })
        )}
        </section>
      </div>
    </main>
  );
}

