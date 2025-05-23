function _id(id) {
    return document.getElementById(id);
}
function _find(target, selector) {
    target = target ? target : document;
    return target.querySelector(selector);
}
function _findAll(target, selector) {
    target = target ? target : document;
    return target.querySelectorAll(selector);
}
function _c(tagName){
    return document.createElement(tagName);
}
function _dom(str) {
    var divdom = document.createElement('div');
    divdom.innerHTML = str;
    return divdom.childNodes;
}
function _on(target, eventName, fun){
    target.addEventListener(eventName, fun);
}