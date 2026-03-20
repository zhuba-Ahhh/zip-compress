/**
 * Huffman 树节点
 * 用于构建动态 Huffman 树，实现对字面量（Literal）的变长编码
 */
export class HuffmanNode {
    // 节点存储的字节值 (0-255)，如果是内部节点则为 null
    value: number | null;
    // 该节点（或其子树）在数据中出现的频率
    freq: number;
    // 左子节点
    left: HuffmanNode | null;
    // 右子节点
    right: HuffmanNode | null;
    
    constructor(value: number | null, freq: number) {
        this.value = value;
        this.freq = freq;
        this.left = null;
        this.right = null;
    }
}
