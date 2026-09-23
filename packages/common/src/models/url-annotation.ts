export type UrlScreenshot = {
    id: string;
    name: string;
    dataUrl: string;
    addedAt: number;
};

export type UrlAnnotation = {
    notes: string;
    tags: string[];
    screenshots: UrlScreenshot[];
    updatedAt: number;
};

export type UrlAnnotationStore = Record<string, UrlAnnotation>;

export const emptyAnnotation = (): UrlAnnotation => ({
    notes: "",
    tags: [],
    screenshots: [],
    updatedAt: 0,
});

export const annotationIsEmpty = (annotation: UrlAnnotation): boolean =>
    annotation.notes.trim() === "" &&
    annotation.tags.length === 0 &&
    annotation.screenshots.length === 0;

export const pruneAnnotationStore = (store: UrlAnnotationStore): UrlAnnotationStore => {
    const next: UrlAnnotationStore = {};
    for (const [url, annotation] of Object.entries(store)) {
        if (!annotationIsEmpty(annotation)) {
            next[url] = annotation;
        }
    }
    return next;
};
