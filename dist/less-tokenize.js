'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = lessTokenize;
var SINGLE_QUOTE = 39; // `''
var DOUBLE_QUOTE = 34; // `"'
var BACKSLASH = 92; // `\'
var SLASH = 47; // `/'
var NEWLINE = 10; // `\n'
var SPACE = 32; // ` '
var FEED = 12; // `\f'
var TAB = 9; // `\t'
var CR = 13; // `\r'
var OPEN_PARENTHESES = 40; // `('
var CLOSE_PARENTHESES = 41; // `)'
var OPEN_CURLY = 123; // `{'
var CLOSE_CURLY = 125; // `}'
var SEMICOLON = 59; // `;'
var ASTERICK = 42; // `*'
var AMPERSAND = 38; // `&'
var COLON = 58; // `:'
var COMMA = 44; // ','
var DOT = 46; // '.'
var AT = 64; // `@'
var HASH = 35; // `#'
var RE_AT_END = /[ \n\t\r\{\(\)'"\\;/]/g;
var RE_WORD_END = /[ \n\t\r\(\)\{\}:;@!'"\\#]|\/(?=\*)/g;
var RE_BAD_BRACKET = /.[\\\/\("'\n]/;
var extendSelector = ':extend';
var extendSelectorLength = extendSelector.length;

function lessTokenize(input) {
    var tokens = [];
    var css = input.css.valueOf();
    var length = css.length;

    var offset = -1;
    var line = 1;
    var pos = 0;
    var openedBlocksCount = 0;
    var openedParenthesesCount = 0;

    function unclosed(what) {
        throw input.error('Unclosed ' + what, line, pos - offset);
    }

    while (pos < length) {
        var code = css.charCodeAt(pos);
        var prev = undefined;
        var next = undefined;
        var ch = undefined;
        var escaped = undefined;
        var quote = undefined;
        var lines = undefined;
        var last = undefined;
        var content = undefined;
        var escape = undefined;
        var nextLine = undefined;
        var nextOffset = undefined;
        var escapePos = undefined;
        var token = undefined;
        var part = undefined;

        if (code === NEWLINE) {
            offset = pos;
            line += 1;
        }

        switch (code) {
            case NEWLINE:
            case SPACE:
            case TAB:
            case CR:
            case FEED:
                next = pos;

                do {
                    next += 1;
                    code = css.charCodeAt(next);

                    if (code === NEWLINE) {
                        offset = next;
                        line += 1;
                    }
                } while (code === SPACE || code === NEWLINE || code === TAB || code === CR || code === FEED);

                tokens.push(['space', css.slice(pos, next)]);
                pos = next - 1;
                break;

            case OPEN_CURLY:
                openedBlocksCount++;
                tokens.push(['{', '{', line, pos - offset]);
                break;

            case CLOSE_CURLY:
                openedBlocksCount--;
                tokens.push(['}', '}', line, pos - offset]);
                break;

            case COLON:
                tokens.push([':', ':', line, pos - offset]);
                break;

            case SEMICOLON:
                tokens.push([';', ';', line, pos - offset]);
                break;

            case COMMA:
                tokens.push(['word', ',', line, pos - offset, line, pos - offset + 1]);
                break;

            case OPEN_PARENTHESES:
                openedParenthesesCount++;
                prev = tokens.length ? tokens[tokens.length - 1][1] : '';
                ch = css.charCodeAt(pos + 1);
                if (prev === 'url' && ch !== SINGLE_QUOTE && ch !== DOUBLE_QUOTE && ch !== SPACE && ch !== NEWLINE && ch !== TAB && ch !== FEED && ch !== CR) {
                    next = pos;
                    do {
                        escaped = false;
                        next = css.indexOf(')', next + 1);
                        if (next === -1) unclosed('bracket');
                        escapePos = next;
                        while (css.charCodeAt(escapePos - 1) === BACKSLASH) {
                            escapePos -= 1;
                            escaped = !escaped;
                        }
                    } while (escaped);

                    tokens.push(['brackets', css.slice(pos, next + 1), line, pos - offset, line, next - offset]);
                    pos = next;
                } else {
                    next = css.indexOf(')', pos + 1);
                    content = css.slice(pos, next + 1);

                    if (next === -1 || RE_BAD_BRACKET.test(content)) {
                        tokens.push(['(', '(', line, pos - offset]);
                    } else {
                        tokens.push(['brackets', content, line, pos - offset, line, next - offset]);
                        pos = next;
                    }
                }

                break;

            case CLOSE_PARENTHESES:
                openedParenthesesCount--;
                tokens.push([')', ')', line, pos - offset]);
                break;

            case SINGLE_QUOTE:
            case DOUBLE_QUOTE:
                quote = code === SINGLE_QUOTE ? '\'' : '"';
                next = pos;
                do {
                    escaped = false;
                    next = css.indexOf(quote, next + 1);
                    if (next === -1) unclosed('quote');
                    escapePos = next;
                    while (css.charCodeAt(escapePos - 1) === BACKSLASH) {
                        escapePos -= 1;
                        escaped = !escaped;
                    }
                } while (escaped);

                tokens.push(['string', css.slice(pos, next + 1), line, pos - offset, line, next - offset]);
                pos = next;
                break;

            case AT:
                RE_AT_END.lastIndex = pos + 1;
                RE_AT_END.test(css);
                if (RE_AT_END.lastIndex === 0) {
                    next = css.length - 1;
                } else {
                    next = RE_AT_END.lastIndex - 2;
                }

                tokens.push(['at-word', css.slice(pos, next + 1), line, pos - offset, line, next - offset]);

                pos = next;
                break;

            case BACKSLASH:
                next = pos;
                escape = true;
                while (css.charCodeAt(next + 1) === BACKSLASH) {
                    next += 1;
                    escape = !escape;
                }
                code = css.charCodeAt(next + 1);
                if (escape && code !== SLASH && code !== SPACE && code !== NEWLINE && code !== TAB && code !== CR && code !== FEED) {
                    next += 1;
                }
                tokens.push(['word', css.slice(pos, next + 1), line, pos - offset, line, next - offset]);
                pos = next;
                break;

            default:
                ch = css.charCodeAt(pos + 1);

                if (code === DOT || code === HASH) {

                    // look for inner mixin
                    if (openedBlocksCount > 0) {
                        next = pos;
                        ch = css[next];
                        var skip = true;
                        var openedMixinBracketsCount = 0;
                        var linesCount = 0;

                        do {
                            next++;
                            ch = css[next];

                            if (ch === '(') {
                                openedMixinBracketsCount++;
                            } else if (ch === ')') {
                                openedMixinBracketsCount--;
                            } else if (ch === '{' && !openedMixinBracketsCount) {
                                skip = false;
                                break;
                            } else if (ch === '\r\n' || ch === '\n') {
                                linesCount++;
                            }
                        } while (openedMixinBracketsCount || ch && ch !== ';');

                        //skip inner mixin
                        if (skip) {
                            tokens.push(['mixin', css.slice(pos, next), line, pos - offset, line + linesCount, next - offset]);

                            line += linesCount;
                            pos = next;
                            break;
                        }
                    }
                } else if (code === AMPERSAND) {
                    next = pos + 1;

                    // look for inner extend
                    if (openedBlocksCount > 0 && css.slice(next, next + extendSelectorLength) === extendSelector) {

                        //skip inner extend
                        next = css.indexOf(String.fromCharCode(SEMICOLON), next + extendSelectorLength) + 1;

                        tokens.push(['extend', css.slice(pos, next), line, pos - offset, line + 1, next - offset]);

                        line++;
                        pos = next;
                        break;
                    }
                } else if (code === HASH && ch === OPEN_CURLY) {
                    next = css.indexOf('}', pos + 2);
                    if (next === -1) unclosed('interpolation');

                    content = css.slice(pos, next + 1);
                    lines = content.split('\n');
                    last = lines.length - 1;

                    if (last > 0) {
                        nextLine = line + last;
                        nextOffset = next - lines[last].length;
                    } else {
                        nextLine = line;
                        nextOffset = offset;
                    }

                    tokens.push(['word', content, line, pos - offset, nextLine, next - nextOffset]);

                    offset = nextOffset;
                    line = nextLine;
                    pos = next;
                } else if (code === SLASH && ch === ASTERICK) {
                    next = css.indexOf('*/', pos + 2) + 1;
                    if (next === 0) unclosed('comment');

                    content = css.slice(pos, next + 1);
                    lines = content.split('\n');
                    last = lines.length - 1;

                    if (last > 0) {
                        nextLine = line + last;
                        nextOffset = next - lines[last].length;
                    } else {
                        nextLine = line;
                        nextOffset = offset;
                    }

                    tokens.push(['comment', content, line, pos - offset, nextLine, next - nextOffset]);

                    offset = nextOffset;
                    line = nextLine;
                    pos = next;
                } else if (code === SLASH && ch === SLASH) {
                    next = css.indexOf('\n', pos + 2) - 1;
                    if (next === -2) next = css.length - 1;

                    content = css.slice(pos, next + 1);

                    tokens.push(['comment', content, line, pos - offset, line, next - offset, 'inline']);

                    pos = next;
                } else {
                    RE_WORD_END.lastIndex = pos + 1;
                    RE_WORD_END.test(css);
                    if (RE_WORD_END.lastIndex === 0) {
                        next = css.length - 1;
                    } else {
                        next = RE_WORD_END.lastIndex - 2;
                    }

                    tokens.push(['word', css.slice(pos, next + 1), line, pos - offset, line, next - offset]);

                    pos = next;
                }

                break;
        }

        pos++;
    }

    return tokens;
}