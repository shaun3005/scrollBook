import React from 'react';
import styles from './BookPage.module.css';
import type { ContentChunk } from '../types/model';

type BookPageItem = ContentChunk['items'][0];

interface BookPageProps {
    data: BookPageItem;
}

const BookPage: React.FC<BookPageProps> = ({ data }) => {
    return (
        <div className={styles.bookPage} style={{
            background: data.backgroundImage || '#212121ff',
        }}
            role="article"
            aria-label={data.text}>
            {/* Content Container */}
            <div className={styles.contentContainer}>
                <div className={styles.pageHeader}>
                    <h2 className={styles.bookTitleSmall}>{data.bookTitle}</h2>
                    <h3 className={styles.chapterTitleSmall}>{data.chapterTitle} <span>by {data.author}</span></h3>
                </div>

                <p className={styles.sentenceContent}>
                    {data.text}
                </p>

                <div className={styles.pageFooter}>
                </div>
            </div>


        </div>
    );
};

export default BookPage;
