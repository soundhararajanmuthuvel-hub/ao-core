function makeMongooseCompatible(model, associations = {}) {
  const originalToJSON = model.prototype.toJSON;

  model.prototype.toJSON = function () {
    // Call the original toJSON to get clean attributes
    let values = {};
    if (originalToJSON) {
      values = originalToJSON.call(this);
    } else {
      values = { ...this.get() };
    }

    // Mongoose models always return _id instead of/in addition to id
    if (values.id !== undefined) {
      values._id = values.id;
    }

    // Map associations for Mongoose compatibility
    for (const [alias, fk] of Object.entries(associations)) {
      if (values[alias] !== undefined) {
        // If the association is loaded, let's make sure it's recursively serialized
        if (values[alias] && typeof values[alias] === 'object') {
          if (Array.isArray(values[alias])) {
            values[alias] = values[alias].map((item) => {
              if (item && typeof item.toJSON === 'function') {
                return item.toJSON();
              }
              if (item && typeof item === 'object') {
                const itemValues = item.get ? item.get() : { ...item };
                if (itemValues.id !== undefined) {
                  itemValues._id = itemValues.id;
                }
                return itemValues;
              }
              return item;
            });
          } else if (typeof values[alias].toJSON === 'function') {
            values[alias] = values[alias].toJSON();
          } else {
            const itemValues = values[alias].get ? values[alias].get() : { ...values[alias] };
            if (itemValues.id !== undefined) {
              itemValues._id = itemValues.id;
            }
            values[alias] = itemValues;
          }
        }
      } else if (values[fk] !== undefined) {
        // If association is NOT loaded but the foreign key is set,
        // map it to the alias field (simulates mongoose returning the ID string)
        values[alias] = values[fk];
      }
    }

    return values;
  };
}

module.exports = { makeMongooseCompatible };
