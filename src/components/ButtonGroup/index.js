import { cloneElement } from 'preact';
import { createClassName, memo } from '../helpers';
import styles from './styles';


export const ButtonGroup = memo(({ children }) => (
	<div className={createClassName(styles, 'button-group')}>
		{children.map((child) => cloneElement(child, { className: createClassName(styles, 'button-group__item') }))}
	</div>
));
