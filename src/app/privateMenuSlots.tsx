import {
  DishEditorHost,
  DishPicker,
  useDishEditor,
  useMenuData,
  useOpWatch,
} from '../features/seller-menu';
import type { PrivateMenuSlots } from '../features/seller-private';

/** Plan 081: the private order editor picks and makes dishes with the menu feature's own pieces. */
export const PRIVATE_MENU_SLOTS: PrivateMenuSlots = {
  useMenuData,
  useDishTools: (onCreated) => {
    const { data } = useMenuData();
    const editor = useDishEditor();
    // A dish made here is saved to the library; the editor joins it to the order once it is there.
    useOpWatch(['createDish'], {
      onDone: (result) => {
        if (result.dishId) onCreated(result.dishId);
      },
    });
    return {
      picker: (props) => (
        <DishPicker {...props} onNewDish={() => editor.open('new')} showLastUsed={false} />
      ),
      editor: data ? (
        <DishEditorHost data={data} value={editor.value} onClose={editor.close} asChef />
      ) : null,
    };
  },
};
