import PreloadStore from "discourse/lib/preload-store";
import RestAdapter from "discourse/adapters/rest";
import { ajax } from "discourse/lib/ajax";
import getURL from "discourse-common/lib/get-url";

export function finderFor(filter, params) {
  return function () {
    let url = getURL("/") + filter + ".json";

    if (params) {
      const keys = Object.keys(params),
        encoded = [];

      keys.forEach(function (p) {
        const value = encodeURI(params[p]);
        if (typeof value !== "undefined") {
          encoded.push(p + "=" + value);
        }
      });

      if (encoded.length > 0) {
        url += "?" + encoded.join("&");
      }
    }
    return ajax(url);
  };
}

export default RestAdapter.extend({
  async find(store, type, findArgs) {
    const { filter, params } = findArgs;

    const result = await PreloadStore.getAndRemove(
      `topic_list_${filter}`,
      finderFor(filter, params)
    );

    result.filter = filter;
    result.params = params;
    return result;
  },
});
